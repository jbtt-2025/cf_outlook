package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"cf_outlook/common"
	"cf_outlook/model"
)

var deadPattern = regexp.MustCompile(`(?i)AADSTS50173|AADSTS700082|AADSTS700084|AADSTS700016|invalid_grant|interaction_required`)

type GraphRecipient struct {
	EmailAddress GraphEmailAddress `json:"emailAddress"`
}

type GraphEmailAddress struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

type GraphItemBody struct {
	ContentType string `json:"contentType"`
	Content     string `json:"content"`
}

type GraphHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type GraphMessageItem struct {
	ID                     string          `json:"id"`
	Subject                string          `json:"subject"`
	ReceivedDateTime       string          `json:"receivedDateTime"`
	From                   *GraphRecipient `json:"from"`
	BodyPreview            string          `json:"bodyPreview"`
	Body                   *GraphItemBody  `json:"body"`
	InternetMessageHeaders []GraphHeader   `json:"internetMessageHeaders"`
	IsJunk                 bool            `json:"__is_junk"`
}

type RefreshTokenResponse struct {
	Success          bool   `json:"success"`
	AccessToken      string `json:"access_token,omitempty"`
	ExpiresIn        int    `json:"expires_in,omitempty"`
	NewRefreshToken  string `json:"new_refresh_token,omitempty"`
	ClientID         string `json:"client_id,omitempty"`
	Error            string `json:"error,omitempty"`
	IsDead           bool   `json:"is_dead,omitempty"`
	RateLimitSeconds int    `json:"retry_after,omitempty"`
}

var httpClient = &http.Client{
	Timeout: 30 * time.Second,
}

// DoRefreshToken 使用微软 OAuth2 刷新 Access Token (多 Client ID 回退与死号识别)
func DoRefreshToken(refreshToken, preferredClientID string) (*RefreshTokenResponse, error) {
	clientIDs := make([]string, 0, len(common.FallbackClientIDs)+1)
	if preferredClientID != "" {
		clientIDs = append(clientIDs, preferredClientID)
	}
	for _, cid := range common.FallbackClientIDs {
		if cid != preferredClientID {
			clientIDs = append(clientIDs, cid)
		}
	}

	var lastError string

	for _, clientID := range clientIDs {
		for _, ep := range common.TokenEndpoints {
			form := url.Values{}
			form.Set("client_id", clientID)
			form.Set("refresh_token", refreshToken)
			form.Set("grant_type", "refresh_token")
			if ep.Scope != "" {
				form.Set("scope", ep.Scope)
			}

			req, err := http.NewRequest("POST", ep.URL, strings.NewReader(form.Encode()))
			if err != nil {
				continue
			}
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			req.Header.Set("Accept", "application/json")

			resp, err := httpClient.Do(req)
			if err != nil {
				lastError = err.Error()
				continue
			}

			bodyBytes, _ := io.ReadAll(resp.Body)
			_ = resp.Body.Close()

			var data map[string]interface{}
			_ = json.Unmarshal(bodyBytes, &data)

			if resp.StatusCode == http.StatusOK {
				tokenStr, _ := data["access_token"].(string)
				newRT, _ := data["refresh_token"].(string)
				if newRT == "" {
					newRT = refreshToken
				}
				expiresIn := 3600
				if exp, ok := data["expires_in"].(float64); ok {
					expiresIn = int(exp)
				}

				return &RefreshTokenResponse{
					Success:         true,
					AccessToken:     tokenStr,
					ExpiresIn:       expiresIn,
					NewRefreshToken: newRT,
					ClientID:        clientID,
				}, nil
			}

			errDesc := ""
			if ed, ok := data["error_description"].(string); ok && ed != "" {
				errDesc = ed
			} else if e, ok := data["error"].(string); ok && e != "" {
				errDesc = e
			} else {
				errDesc = fmt.Sprintf("HTTP %d", resp.StatusCode)
			}
			lastError = errDesc

			// 死号快速特征判定
			if deadPattern.MatchString(errDesc) {
				return &RefreshTokenResponse{
					Success: false,
					Error:   errDesc,
					IsDead:  true,
				}, nil
			}
		}
	}

	return &RefreshTokenResponse{
		Success: false,
		Error:   lastError,
		IsDead:  false,
	}, nil
}

// FetchMailMessages 并发获取收件箱与垃圾邮件箱邮件
func FetchMailMessages(accessToken string, top int, includeJunk bool) ([]GraphMessageItem, int, error) {
	if top < 5 {
		top = 5
	}
	if top > 50 {
		top = 50
	}

	selectFields := "id,subject,receivedDateTime,from,bodyPreview,body,internetMessageHeaders"
	query := fmt.Sprintf("$top=%d&$orderby=receivedDateTime desc&$select=%s", top, selectFields)

	inboxURL := fmt.Sprintf("https://graph.microsoft.com/v1.0/me/messages?%s", query)
	junkURL := fmt.Sprintf("https://graph.microsoft.com/v1.0/me/mailFolders/junkemail/messages?%s", query)

	type fetchResult struct {
		isJunk     bool
		statusCode int
		retryAfter int
		items      []GraphMessageItem
		err        error
	}

	resultsChan := make(chan fetchResult, 2)
	var wg sync.WaitGroup

	fetchFolder := func(targetURL string, isJunk bool) {
		defer wg.Done()

		req, err := http.NewRequest("GET", targetURL, nil)
		if err != nil {
			resultsChan <- fetchResult{isJunk: isJunk, err: err}
			return
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("Accept", "application/json")

		resp, err := httpClient.Do(req)
		if err != nil {
			resultsChan <- fetchResult{isJunk: isJunk, err: err}
			return
		}
		defer resp.Body.Close()

		retrySec := 0
		if val := resp.Header.Get("Retry-After"); val != "" {
			retrySec, _ = strconv.Atoi(val)
			if retrySec <= 0 {
				retrySec = 30
			}
		}

		bodyBytes, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			resultsChan <- fetchResult{
				isJunk:     isJunk,
				statusCode: 429,
				retryAfter: retrySec,
				err:        fmt.Errorf("rate limited (429)"),
			}
			return
		}

		if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
			resultsChan <- fetchResult{
				isJunk:     isJunk,
				statusCode: resp.StatusCode,
				err:        fmt.Errorf("graph API status %d", resp.StatusCode),
			}
			return
		}

		var payload struct {
			Value []GraphMessageItem `json:"value"`
		}
		_ = json.Unmarshal(bodyBytes, &payload)

		resultsChan <- fetchResult{
			isJunk:     isJunk,
			statusCode: resp.StatusCode,
			items:      payload.Value,
		}
	}

	wg.Add(1)
	go fetchFolder(inboxURL, false)

	if includeJunk {
		wg.Add(1)
		go fetchFolder(junkURL, true)
	}

	wg.Wait()
	close(resultsChan)

	var rawList []GraphMessageItem
	for res := range resultsChan {
		if res.statusCode == 429 {
			return nil, res.retryAfter, fmt.Errorf("rate limited (429)")
		}
		if res.err != nil && res.statusCode != http.StatusNotFound {
			// 收件箱报错则直接返回错误
			if !res.isJunk {
				return nil, 0, res.err
			}
		}
		for i := range res.items {
			res.items[i].IsJunk = res.isJunk
			rawList = append(rawList, res.items[i])
		}
	}

	// 严格按 ID 去重
	seen := make(map[string]struct{}, len(rawList))
	deduped := make([]GraphMessageItem, 0, len(rawList))
	for _, m := range rawList {
		if m.ID == "" {
			continue
		}
		if _, ok := seen[m.ID]; !ok {
			seen[m.ID] = struct{}{}
			deduped = append(deduped, m)
		}
	}

	// 倒序排列 (最新邮件优先)
	sort.Slice(deduped, func(i, j int) bool {
		return deduped[i].ReceivedDateTime > deduped[j].ReceivedDateTime
	})

	return deduped, 0, nil
}

type SyncResult struct {
	Account         *model.Account
	NewRefreshToken string
	ClientID        string
	MessagesCount   int
}

// DoSyncAccountMail 完整的单账号轮换与拉取同步服务
func DoSyncAccountMail(account *model.Account) (*SyncResult, error) {
	now := time.Now().UnixMilli()

	prefCID := ""
	if account.ClientID != nil {
		prefCID = *account.ClientID
	}

	tokenRes, _ := DoRefreshToken(account.RefreshToken, prefCID)
	if !tokenRes.Success {
		deadReason := tokenRes.Error
		status := "idle"
		if tokenRes.IsDead {
			status = "dead"
		}
		_ = model.UpdateAccountSyncResult(account.ID, map[string]interface{}{
			"status":          status,
			"dead_reason":     deadReason,
			"last_checked_at": now,
		})
		account.Status = status
		account.DeadReason = &deadReason
		account.LastCheckedAt = &now
		return &SyncResult{Account: account}, nil
	}

	newRT := tokenRes.NewRefreshToken
	usedCID := tokenRes.ClientID

	messages, retryAfter, err := FetchMailMessages(tokenRes.AccessToken, 25, true)
	if err != nil {
		if retryAfter > 0 {
			rateLimitUntil := now + int64(retryAfter)*1000
			_ = model.UpdateAccountSyncResult(account.ID, map[string]interface{}{
				"status":           "rate_limited",
				"rate_limit_until": rateLimitUntil,
				"refresh_token":    newRT,
				"client_id":        usedCID,
				"last_checked_at":  now,
			})
			account.Status = "rate_limited"
			account.RateLimitUntil = &rateLimitUntil
			account.RefreshToken = newRT
			account.ClientID = &usedCID
			account.LastCheckedAt = &now
			return &SyncResult{Account: account}, nil
		}

		_ = model.UpdateAccountSyncResult(account.ID, map[string]interface{}{
			"status":          "idle",
			"refresh_token":   newRT,
			"client_id":       usedCID,
			"last_checked_at": now,
		})
		account.RefreshToken = newRT
		account.ClientID = &usedCID
		account.LastCheckedAt = &now
		return &SyncResult{Account: account}, nil
	}

	latestCode := ""
	latestCodeTime := ""
	if account.LatestCode != nil {
		latestCode = *account.LatestCode
	}
	if account.LatestCodeTime != nil {
		latestCodeTime = *account.LatestCodeTime
	}

	emailsToSave := make([]model.Email, 0, len(messages))
	for _, m := range messages {
		htmlContent := ""
		if m.Body != nil {
			htmlContent = m.Body.Content
		}

		code := ExtractVerificationCode(m.Subject, m.BodyPreview, htmlContent)
		dateStr := m.ReceivedDateTime
		if dateStr == "" {
			dateStr = time.Now().UTC().Format(time.RFC3339)
		}

		if code != "" {
			if latestCodeTime == "" || dateStr >= latestCodeTime {
				latestCode = code
				latestCodeTime = dateStr
			}
		}

		senderName := ""
		senderAddress := ""
		if m.From != nil {
			senderName = m.From.EmailAddress.Name
			senderAddress = m.From.EmailAddress.Address
		}

		junkVal := 0
		if m.IsJunk {
			junkVal = 1
		}

		var rawHeadersStr *string
		if len(m.InternetMessageHeaders) > 0 {
			hBytes, _ := json.Marshal(m.InternetMessageHeaders)
			s := string(hBytes)
			rawHeadersStr = &s
		}

		var codePtr *string
		if code != "" {
			codePtr = &code
		}

		emailsToSave = append(emailsToSave, model.Email{
			ID:            m.ID,
			UserID:        account.UserID,
			AccountEmail:  strings.ToLower(account.Email),
			Subject:       m.Subject,
			SenderName:    senderName,
			SenderAddress: senderAddress,
			ReceivedAt:    dateStr,
			BodyPreview:   m.BodyPreview,
			BodyHTML:      htmlContent,
			ExtractedCode: codePtr,
			IsJunk:        junkVal,
			IsRead:        0,
			RawHeaders:    rawHeadersStr,
		})
	}

	// 批量保存邮件
	if len(emailsToSave) > 0 {
		_ = model.SaveEmailsBatch(emailsToSave)
	}

	status := "active"
	if len(messages) == 0 {
		status = "empty"
	}

	updates := map[string]interface{}{
		"refresh_token":   newRT,
		"client_id":       usedCID,
		"status":          status,
		"last_checked_at": now,
		"unread_count":    len(messages),
		"dead_reason":     nil,
	}
	if latestCode != "" {
		updates["latest_code"] = latestCode
		updates["latest_code_time"] = latestCodeTime
		account.LatestCode = &latestCode
		account.LatestCodeTime = &latestCodeTime
	}

	_ = model.UpdateAccountSyncResult(account.ID, updates)

	account.RefreshToken = newRT
	account.ClientID = &usedCID
	account.Status = status
	account.LastCheckedAt = &now
	account.UnreadCount = len(messages)

	return &SyncResult{
		Account:         account,
		NewRefreshToken: newRT,
		ClientID:        usedCID,
		MessagesCount:   len(messages),
	}, nil
}
