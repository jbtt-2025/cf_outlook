package controller

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"cf_outlook/common"
	"cf_outlook/model"
	"cf_outlook/service"
	"github.com/gin-gonic/gin"
)

func ListAccounts(c *gin.Context) {
	userID := c.GetString("user_id")

	limitStr := c.Query("limit")
	offsetStr := c.Query("offset")

	limit := 0
	offset := 0
	if limitStr != "" {
		limit, _ = strconv.Atoi(limitStr)
	}
	if offsetStr != "" {
		offset, _ = strconv.Atoi(offsetStr)
	}

	accounts, err := model.ListAccountsByUser(userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "查询账号失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "accounts": accounts})
}

type AccountImportItem struct {
	Email        string   `json:"email"`
	Password     *string  `json:"password,omitempty"`
	RefreshToken string   `json:"refresh_token"`
	ClientID     *string  `json:"client_id,omitempty"`
	Tags         []string `json:"tags,omitempty"`
}

type ImportAccountsRequest struct {
	Accounts []AccountImportItem `json:"accounts"`
}

func ImportAccounts(c *gin.Context) {
	userID := c.GetString("user_id")

	var req ImportAccountsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "导入数据格式无效"})
		return
	}

	now := time.Now().UnixMilli()
	records := make([]model.Account, 0, len(req.Accounts))

	for _, item := range req.Accounts {
		cleanEmail := strings.ToLower(strings.TrimSpace(item.Email))
		cleanRT := strings.TrimSpace(item.RefreshToken)
		if cleanEmail == "" || cleanRT == "" {
			continue
		}

		accountID := userID + "_" + cleanEmail
		cid := common.DefaultClientID
		if item.ClientID != nil && strings.TrimSpace(*item.ClientID) != "" {
			cid = strings.TrimSpace(*item.ClientID)
		}

		tagBytes, _ := json.Marshal(item.Tags)
		if len(item.Tags) == 0 {
			tagBytes = []byte("[]")
		}

		records = append(records, model.Account{
			ID:           accountID,
			UserID:       userID,
			Email:        cleanEmail,
			Password:     item.Password,
			RefreshToken: cleanRT,
			ClientID:     &cid,
			Status:       "idle",
			Tags:         string(tagBytes),
			CreatedAt:    now,
		})
	}

	savedCount, err := model.SaveAccountsBatch(records)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "批量保存账号失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "count": savedCount})
}

type UpdateTagsRequest struct {
	Tags []string `json:"tags"`
}

func UpdateAccountTags(c *gin.Context) {
	userID := c.GetString("user_id")
	accountID := c.Param("id")

	var req UpdateTagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "标签数据格式无效"})
		return
	}

	cleanTags := make([]string, 0, len(req.Tags))
	seen := make(map[string]struct{})
	for _, t := range req.Tags {
		trimmed := strings.TrimSpace(t)
		if trimmed != "" {
			if _, ok := seen[trimmed]; !ok {
				seen[trimmed] = struct{}{}
				cleanTags = append(cleanTags, trimmed)
			}
		}
	}

	if err := model.UpdateAccountTags(userID, accountID, cleanTags); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "更新标签失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "tags": cleanTags})
}

func SyncAccount(c *gin.Context) {
	userID := c.GetString("user_id")
	accountID := c.Param("id")

	acc, err := model.GetAccountByID(userID, accountID)
	if err != nil || acc == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "未找到该邮箱账号"})
		return
	}

	res, err := service.DoSyncAccountMail(acc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"account":           res.Account,
		"messages_count":    res.MessagesCount,
		"new_refresh_token": res.NewRefreshToken,
	})
}

func DeleteAccount(c *gin.Context) {
	userID := c.GetString("user_id")
	accountID := c.Param("id")

	if err := model.DeleteAccount(userID, accountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "删除账号失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func PurgeDeadAccounts(c *gin.Context) {
	userID := c.GetString("user_id")

	count, err := model.PurgeDeadAccounts(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "清理失效账号失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "count": count})
}
