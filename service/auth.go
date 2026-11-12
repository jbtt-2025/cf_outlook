package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"cf_outlook/common"
	"cf_outlook/model"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/crypto/pbkdf2"
)

type JWTClaims struct {
	Sub      string `json:"sub"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

const (
	pbkdf2Iterations = 100000
	jwtTTL           = 7 * 24 * time.Hour
)

// HashPassword 生成加盐密码哈希 (默认采用安全工业级 bcrypt)
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// HashPasswordPBKDF2 兼容现有 Cloudflare WebCrypto PBKDF2 算法的加盐密码哈希
func HashPasswordPBKDF2(password string) string {
	salt := make([]byte, 16)
	_, _ = rand.Read(salt)
	saltHex := hex.EncodeToString(salt)

	hash := pbkdf2.Key([]byte(password), salt, pbkdf2Iterations, 32, sha256.New)
	hashHex := hex.EncodeToString(hash)

	return fmt.Sprintf("$pbkdf2$%d$%s$%s", pbkdf2Iterations, saltHex, hashHex)
}

// VerifyPassword 校验密码（同时无缝支持 bcrypt 和既有 $pbkdf2$ 密码）
func VerifyPassword(password, storedHash string) bool {
	if storedHash == "" {
		return false
	}

	// 1. 若为 Cloudflare 原生 $pbkdf2$ 格式
	if strings.HasPrefix(storedHash, "$pbkdf2$") {
		parts := strings.Split(storedHash, "$")
		if len(parts) != 5 {
			return false
		}

		iterations, err := strconv.Atoi(parts[2])
		if err != nil {
			return false
		}
		saltHex := parts[3]
		expectedHashHex := parts[4]

		salt, err := hex.DecodeString(saltHex)
		if err != nil {
			return false
		}

		computedHash := pbkdf2.Key([]byte(password), salt, iterations, 32, sha256.New)
		computedHashHex := hex.EncodeToString(computedHash)

		return hmac.Equal([]byte(computedHashHex), []byte(expectedHashHex))
	}

	// 2. 默认 bcrypt 校验
	err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password))
	return err == nil
}

// CreateJWTToken 签发 JWT
func CreateJWTToken(user *model.User) (string, error) {
	now := time.Now()
	claims := JWTClaims{
		Sub:      user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(jwtTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(common.JWTSecret))
}

// VerifyJWTToken 验证并解析 JWT
func VerifyJWTToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(common.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}
