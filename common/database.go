package common

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() error {
	var dialector gorm.Dialector

	logLevel := logger.Warn
	if GinMode == "debug" {
		logLevel = logger.Info
	}

	gormConfig := &gorm.Config{
		Logger:                                   logger.Default.LogMode(logLevel),
		PrepareStmt:                              true,
		DisableForeignKeyConstraintWhenMigrating: true, // 避免多数据库方言外键名冲突
	}

	driver := strings.ToLower(strings.TrimSpace(DBDriver))

	switch driver {
	case "sqlite", "sqlite3":
		dialector = sqlite.Open(DBDSN)

	case "mysql":
		dsn := DBDSN
		// 确保 MySQL 连接包含必要编码与时间解析参数
		if !strings.Contains(dsn, "charset=") {
			sep := "?"
			if strings.Contains(dsn, "?") {
				sep = "&"
			}
			dsn += sep + "charset=utf8mb4&parseTime=True&loc=Local"
		}
		// DefaultStringSize: 191 确保对 MySQL 5.7 索引 767 字节限制 100% 兼容
		dialector = mysql.New(mysql.Config{
			DSN:                       dsn,
			DefaultStringSize:         191,
			SkipInitializeWithVersion: false,
		})

	case "postgres", "postgresql", "pg":
		dialector = postgres.Open(DBDSN)

	default:
		return fmt.Errorf("unsupported database driver: %s (supported: sqlite, mysql, postgres)", driver)
	}

	db, err := gorm.Open(dialector, gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to database [%s]: %w", driver, err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// 优化 SQLite 并发读写性能（启用 WAL 模式与防锁死超时）
	if driver == "sqlite" || driver == "sqlite3" {
		db.Exec("PRAGMA journal_mode = WAL;")
		db.Exec("PRAGMA busy_timeout = 5000;")
		db.Exec("PRAGMA synchronous = NORMAL;")
		sqlDB.SetMaxOpenConns(1) // SQLite 文件写事务锁建议单写并发
	} else {
		sqlDB.SetMaxIdleConns(20)
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}

	DB = db
	log.Printf("[DB] Database connected successfully via driver [%s]", driver)
	return nil
}

func CloseDB() {
	if DB != nil {
		if sqlDB, err := DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}
}
