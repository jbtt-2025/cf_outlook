package controller

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"cf_outlook/model"
	"cf_outlook/service"
	"github.com/gin-gonic/gin"
)

func GetCaptcha(c *gin.Context) {
	code := service.GenerateRandomCode(4)
	captchaID, err := service.CreateCaptchaToken(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "生成验证码失败"})
		return
	}
	svg := service.RenderCaptchaSvg(code, 120, 40)
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"captcha_id": captchaID,
		"svg":        svg,
	})
}

func GetStatus(c *gin.Context) {
	count, err := model.GetUserCount()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"has_admin": false,
			"db_ready":  false,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"has_admin": count > 0,
		"db_ready":  true,
	})
}

type RegisterRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	CaptchaID   string `json:"captcha_id"`
	CaptchaCode string `json:"captcha_code"`
}

func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数解析失败"})
		return
	}

	cleanUsername := strings.ToLower(strings.TrimSpace(req.Username))
	if len(cleanUsername) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "用户名至少需要 3 个字符"})
		return
	}
	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "密码长度至少需要 6 位"})
		return
	}

	// 验证码防穷举校验
	valid, reason := service.VerifyCaptcha(req.CaptchaID, req.CaptchaCode)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": reason})
		return
	}

	existing, _ := model.GetUserByUsername(cleanUsername)
	if existing != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "该用户名已被注册"})
		return
	}

	userCount, _ := model.GetUserCount()
	role := "user"
	if userCount == 0 {
		role = "admin" // 系统的首任注册者自动成为超级管理员
	}

	hash, err := service.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "密码散列计算失败"})
		return
	}

	randBytes := make([]byte, 8)
	_, _ = rand.Read(randBytes)
	userID := "usr_" + hex.EncodeToString(randBytes)
	now := time.Now().UnixMilli()

	newUser := &model.User{
		ID:           userID,
		Username:     cleanUsername,
		PasswordHash: hash,
		Role:         role,
		Status:       "active",
		CreatedAt:    now,
		LastLoginAt:  &now,
	}

	if err := model.CreateUser(newUser); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "创建用户失败: " + err.Error()})
		return
	}

	token, err := service.CreateJWTToken(newUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "签发 Token 失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"user": gin.H{
			"id":       newUser.ID,
			"username": newUser.Username,
			"role":     newUser.Role,
			"status":   newUser.Status,
		},
	})
}

type LoginRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	CaptchaID   string `json:"captcha_id"`
	CaptchaCode string `json:"captcha_code"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数解析失败"})
		return
	}

	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请输入用户名和密码"})
		return
	}

	// 验证码防穷举校验
	valid, reason := service.VerifyCaptcha(req.CaptchaID, req.CaptchaCode)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": reason})
		return
	}

	user, err := model.GetUserByUsername(req.Username)
	if err != nil || user == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "用户名或密码错误"})
		return
	}

	if user.Status == "disabled" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "该账号已被管理员停用，请联系管理员"})
		return
	}

	if !service.VerifyPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "用户名或密码错误"})
		return
	}

	now := time.Now().UnixMilli()
	_ = model.UpdateUser(user.ID, map[string]interface{}{"last_login_at": now})

	token, err := service.CreateJWTToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "签发 Token 失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
			"status":   user.Status,
		},
	})
}

func GetMe(c *gin.Context) {
	userID := c.GetString("user_id")
	user, err := model.GetUserByID(userID)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "用户不存在或登录已失效"})
		return
	}

	if user.Status == "disabled" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "账号已被停用"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user": gin.H{
			"id":            user.ID,
			"username":      user.Username,
			"role":          user.Role,
			"status":        user.Status,
			"created_at":    user.CreatedAt,
			"last_login_at": user.LastLoginAt,
		},
	})
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

func ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "请求参数无效"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "新密码长度必须至少为 6 位"})
		return
	}

	userID := c.GetString("user_id")
	user, err := model.GetUserByID(userID)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "用户不存在"})
		return
	}

	if !service.VerifyPassword(req.OldPassword, user.PasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "原密码输入错误"})
		return
	}

	newHash, err := service.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "密码计算失败"})
		return
	}

	_ = model.UpdateUser(user.ID, map[string]interface{}{"password_hash": newHash})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "密码修改成功"})
}
