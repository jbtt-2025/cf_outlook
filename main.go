package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"cf_outlook/common"
	"cf_outlook/model"
	"cf_outlook/router"
)

//go:embed dist/*
var embeddedDistFS embed.FS

func main() {
	common.InitConfig()

	log.Printf("==================================================")
	log.Printf("  Outlook Batch Manager (Go Edition v%s)", common.Version)
	log.Printf("  Architecture: Reference new-api (Gin + GORM)")
	log.Printf("  Database: %s | DSN: %s", common.DBDriver, common.DBDSN)
	log.Printf("==================================================")

	// 1. 初始化多数据库连接
	if err := common.InitDB(); err != nil {
		log.Fatalf("[FATAL] 数据库连接失败: %v", err)
	}
	defer common.CloseDB()

	// 2. 执行模型自动迁移 AutoMigrate
	if err := model.InitModel(); err != nil {
		log.Fatalf("[FATAL] 数据库表结构初始化失败: %v", err)
	}

	// 3. 处理内嵌静态文件系统
	var distSubFS fs.FS
	if sub, err := fs.Sub(embeddedDistFS, "dist"); err == nil {
		distSubFS = sub
	} else {
		distSubFS = embeddedDistFS
	}

	// 4. 初始化路由
	r := router.SetupRouter(distSubFS)

	serverAddr := fmt.Sprintf(":%s", common.Port)
	srv := &http.Server{
		Addr:    serverAddr,
		Handler: r,
	}

	go func() {
		log.Printf("[HTTP] 服务已启动，可直接在浏览器访问: http://localhost:%s", common.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] HTTP 服务监听失败: %v", err)
		}
	}()

	// 优雅关机监听
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[SHUTDOWN] 收到关机信号，正在安全关闭服务...")
}
