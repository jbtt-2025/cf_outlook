package controller

import (
	"net/http"
	"strconv"
	"strings"

	"cf_outlook/model"
	"github.com/gin-gonic/gin"
)

func ListEmails(c *gin.Context) {
	userID := c.GetString("user_id")

	opts := model.EmailQueryOptions{}

	if accEmail := c.Query("account_email"); accEmail != "" {
		opts.AccountEmail = &accEmail
	}

	if junkStr := c.Query("is_junk"); junkStr != "" {
		val := junkStr == "true" || junkStr == "1"
		opts.IsJunk = &val
	}

	if codeStr := c.Query("has_code"); codeStr == "true" || codeStr == "1" {
		opts.HasCode = true
	}

	if unreadStr := c.Query("unread_only"); unreadStr == "true" || unreadStr == "1" {
		opts.UnreadOnly = true
	}

	if search := c.Query("search"); strings.TrimSpace(search) != "" {
		trimmed := strings.TrimSpace(search)
		opts.Search = &trimmed
	}

	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			opts.Limit = limit
		}
	}

	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil {
			opts.Offset = offset
		}
	}

	emails, err := model.ListEmails(userID, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "查询邮件失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "emails": emails})
}

type UpdateReadRequest struct {
	IsRead bool `json:"is_read"`
}

func UpdateEmailRead(c *gin.Context) {
	userID := c.GetString("user_id")
	emailID := c.Param("id")

	var req UpdateReadRequest
	_ = c.ShouldBindJSON(&req)

	if err := model.UpdateEmailReadStatus(userID, emailID, req.IsRead); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "更新已读状态失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteEmail(c *gin.Context) {
	userID := c.GetString("user_id")
	emailID := c.Param("id")

	if err := model.DeleteEmail(userID, emailID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "删除邮件失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
