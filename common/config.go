package common

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

var (
	Version         = "1.0.0"
	Port            = "8080"
	GinMode         = "release"
	DBDriver        = "sqlite"
	DBDSN           = "outlook.db"
	JWTSecret       = "CF_OUTLOOK_JWT_SESSION_SECRET_KEY_V1"
	CaptchaSecret   = "CF_OUTLOOK_CAPTCHA_SECRET_V1_KEY"
	DefaultClientID = "9e5f94bc-e8a4-4e73-b8be-63364c29d753" // Microsoft Authentication Broker
)

var FallbackClientIDs = []string{
	DefaultClientID,
	"d3590ed6-52b3-4102-aeff-aad2292ab01c", // Office
	"27922004-5251-4030-b22d-91ecd9a37ea4", // Outlook
	"000000004FD94165",                      // Outlook Mobile
	"aebc6443-996d-45c2-90f0-388ff96faa56", // VS Code
}

type TokenEndpoint struct {
	URL   string
	Scope string
}

var TokenEndpoints = []TokenEndpoint{
	{
		URL:   "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
		Scope: "https://graph.microsoft.com/.default offline_access",
	},
	{
		URL:   "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
		Scope: "https://graph.microsoft.com/Mail.Read offline_access openid profile",
	},
	{
		URL:   "https://login.microsoftonline.com/common/oauth2/v2.0/token",
		Scope: "https://graph.microsoft.com/.default offline_access",
	},
	{
		URL:   "https://login.live.com/oauth20_token.srf",
		Scope: "https://graph.microsoft.com/.default offline_access",
	},
}

func InitConfig() {
	_ = godotenv.Load()

	if p := os.Getenv("PORT"); p != "" {
		Port = p
	}
	if gm := os.Getenv("GIN_MODE"); gm != "" {
		GinMode = gm
	}

	// 智能识别数据库驱动配置 (对齐 new-api: 支持 SQL_DSN 与 DB_DRIVER / DB_DSN)
	sqlDSN := os.Getenv("SQL_DSN")
	if sqlDSN == "" {
		sqlDSN = os.Getenv("DB_DSN")
	}

	dbDriver := os.Getenv("DB_DRIVER")
	if dbDriver != "" {
		DBDriver = strings.ToLower(strings.TrimSpace(dbDriver))
	} else if sqlDSN != "" {
		// 自动根据 DSN 前缀推断驱动
		lowerDSN := strings.ToLower(sqlDSN)
		if strings.HasPrefix(lowerDSN, "postgres://") || strings.HasPrefix(lowerDSN, "postgresql://") {
			DBDriver = "postgres"
		} else if strings.Contains(lowerDSN, "@tcp(") || strings.HasPrefix(lowerDSN, "mysql://") {
			DBDriver = "mysql"
		} else {
			DBDriver = "sqlite"
		}
	}

	if sqlDSN != "" {
		DBDSN = sqlDSN
	}

	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		JWTSecret = secret
	} else if os.Getenv("SESSION_SECRET") != "" {
		JWTSecret = os.Getenv("SESSION_SECRET")
	}

	if capSecret := os.Getenv("CAPTCHA_SECRET"); capSecret != "" {
		CaptchaSecret = capSecret
	}

	if cid := os.Getenv("DEFAULT_CLIENT_ID"); cid != "" {
		DefaultClientID = cid
	}
}

// GenerateRandomSecret 生成指定字节长度的随机十六进制字符串
func GenerateRandomSecret(byteLen int) string {
	b := make([]byte, byteLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
