package router

import (
	"io/fs"

	"cf_outlook/common"
	"cf_outlook/controller"
	"cf_outlook/middleware"
	"github.com/gin-gonic/gin"
)

func SetupRouter(distFS fs.FS) *gin.Engine {
	gin.SetMode(common.GinMode)
	r := gin.New()
	r.Use(gin.Recovery())
	if common.GinMode == "debug" {
		r.Use(gin.Logger())
	}
	r.Use(middleware.CORSMiddleware())

	// 挂载静态文件 SPA 托管（非 /api/ 路径自动提供）
	if distFS != nil {
		r.Use(middleware.DistMiddleware(distFS))
	}

	api := r.Group("/api")
	{
		// 1. 认证模块
		authGroup := api.Group("/auth")
		{
			authGroup.GET("/captcha", controller.GetCaptcha)
			authGroup.GET("/status", controller.GetStatus)
			authGroup.POST("/register", controller.Register)
			authGroup.POST("/login", controller.Login)

			// 需要登录的个人操作
			authProtected := authGroup.Group("")
			authProtected.Use(middleware.AuthMiddleware())
			{
				authProtected.GET("/me", controller.GetMe)
				authProtected.POST("/change-password", controller.ChangePassword)
			}
		}

		// 2. 超级管理员管理模块
		adminGroup := api.Group("/admin")
		adminGroup.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware())
		{
			adminGroup.GET("/users", controller.ListAdminUsers)
			adminGroup.PUT("/users/:id", controller.UpdateAdminUser)
			adminGroup.POST("/users/:id/reset-password", controller.ResetAdminUserPassword)
			adminGroup.DELETE("/users/:id", controller.DeleteAdminUser)
		}

		// 3. 邮箱凭据管理模块
		accountGroup := api.Group("/accounts")
		accountGroup.Use(middleware.AuthMiddleware())
		{
			accountGroup.GET("", controller.ListAccounts)
			accountGroup.POST("/import", controller.ImportAccounts)
			accountGroup.PUT("/:id/tags", controller.UpdateAccountTags)
			accountGroup.PATCH("/:id/tags", controller.UpdateAccountTags)
			accountGroup.POST("/:id/sync", controller.SyncAccount)
			accountGroup.DELETE("/:id", controller.DeleteAccount)
			accountGroup.POST("/purge-dead", controller.PurgeDeadAccounts)
		}

		// 4. 邮件管理模块
		emailGroup := api.Group("/emails")
		emailGroup.Use(middleware.AuthMiddleware())
		{
			emailGroup.GET("", controller.ListEmails)
			emailGroup.POST("/:id/read", controller.UpdateEmailRead)
			emailGroup.DELETE("/:id", controller.DeleteEmail)
		}

		// 5. 原生无状态代理兼容模块
		api.POST("/token/refresh", controller.RefreshTokenProxy)
		api.POST("/mail/list", controller.MailListProxy)
	}

	return r
}
