package middleware

import (
	"net/http"
	"strings"

	"cf_outlook/service"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "未登录或未提供身份凭证",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "身份凭证格式错误",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimSpace(parts[1])
		claims, err := service.VerifyJWTToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "登录已失效或凭证已过期",
			})
			c.Abort()
			return
		}

		c.Set("user", claims)
		c.Set("user_id", claims.Sub)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists || roleVal.(string) != "admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "无权访问：仅超级管理员可执行该操作",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
