package controller

import (
	"net/http"

	"cf_outlook/service"
	"github.com/gin-gonic/gin"
)

type RefreshTokenProxyRequest struct {
	RefreshToken string `json:"refresh_token"`
	ClientID     string `json:"client_id,omitempty"`
}

func RefreshTokenProxy(c *gin.Context) {
	var req RefreshTokenProxyRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.RefreshToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Missing refresh_token"})
		return
	}

	res, _ := service.DoRefreshToken(req.RefreshToken, req.ClientID)
	status := http.StatusOK
	if !res.Success {
		status = http.StatusBadRequest
	}

	c.JSON(status, res)
}

type MailListProxyRequest struct {
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ClientID     string `json:"client_id,omitempty"`
	Top          int    `json:"top,omitempty"`
	IncludeJunk  *bool  `json:"include_junk,omitempty"`
}

func MailListProxy(c *gin.Context) {
	var req MailListProxyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid JSON body"})
		return
	}

	accessToken := req.AccessToken
	newRefreshToken := ""
	usedClientID := req.ClientID

	if accessToken == "" && req.RefreshToken != "" {
		tokenRes, _ := service.DoRefreshToken(req.RefreshToken, req.ClientID)
		if !tokenRes.Success {
			c.JSON(http.StatusBadRequest, tokenRes)
			return
		}
		accessToken = tokenRes.AccessToken
		newRefreshToken = tokenRes.NewRefreshToken
		usedClientID = tokenRes.ClientID
	}

	if accessToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Missing access_token or refresh_token"})
		return
	}

	includeJunk := true
	if req.IncludeJunk != nil {
		includeJunk = *req.IncludeJunk
	}

	top := req.Top
	if top <= 0 {
		top = 25
	}

	messages, retryAfter, err := service.FetchMailMessages(accessToken, top, includeJunk)
	if err != nil {
		status := http.StatusInternalServerError
		if retryAfter > 0 {
			status = http.StatusTooManyRequests
		}
		c.JSON(status, gin.H{
			"success":           false,
			"error":             err.Error(),
			"retry_after":       retryAfter,
			"new_refresh_token": newRefreshToken,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"messages":          messages,
		"new_refresh_token": newRefreshToken,
		"client_id":         usedClientID,
	})
}
