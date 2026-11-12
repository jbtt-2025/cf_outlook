package controller

import (
	"net/http"

	"cf_outlook/model"
	"cf_outlook/service"
	"github.com/gin-gonic/gin"
)

func ListAdminUsers(c *gin.Context) {
	users, err := model.ListAllUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "查询用户列表失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "users": users})
}

type UpdateAdminUserRequest struct {
	Role   *string `json:"role"`
	Status *string `json:"status"`
}

func UpdateAdminUser(c *gin.Context) {
	targetUserID := c.Param("id")
	currentUserID := c.GetString("user_id")

	var req UpdateAdminUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "无效的参数"})
		return
	}

	// 保护超级管理员自身不可禁用或降权
	if targetUserID == currentUserID {
		if (req.Role != nil && *req.Role == "user") || (req.Status != nil && *req.Status == "disabled") {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "管理员不可禁用自身或撤销自己的管理员权限"})
			return
		}
	}

	updates := make(map[string]interface{})
	if req.Role != nil && (*req.Role == "admin" || *req.Role == "user") {
		updates["role"] = *req.Role
	}
	if req.Status != nil && (*req.Status == "active" || *req.Status == "disabled") {
		updates["status"] = *req.Status
	}

	if len(updates) > 0 {
		_ = model.UpdateUser(targetUserID, updates)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

type ResetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

func ResetAdminUserPassword(c *gin.Context) {
	targetUserID := c.Param("id")
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "重置密码长度至少需要 6 位"})
		return
	}

	newHash, err := service.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "生成密码哈希失败"})
		return
	}

	_ = model.UpdateUser(targetUserID, map[string]interface{}{"password_hash": newHash})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "密码重置成功"})
}

func DeleteAdminUser(c *gin.Context) {
	targetUserID := c.Param("id")
	currentUserID := c.GetString("user_id")

	if targetUserID == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "管理员不可删除自身账号"})
		return
	}

	if err := model.DeleteUserAndData(targetUserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "删除用户失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
