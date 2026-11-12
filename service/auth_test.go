package service

import (
	"testing"

	"cf_outlook/model"
)

func TestAuthFlow(t *testing.T) {
	password := "TestSecretPassword123!"

	// 1. 测试 bcrypt
	bcryptHash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if !VerifyPassword(password, bcryptHash) {
		t.Fatalf("VerifyPassword failed for bcrypt")
	}
	if VerifyPassword("WrongPass", bcryptHash) {
		t.Fatalf("VerifyPassword should fail for wrong password")
	}

	// 2. 测试 PBKDF2 兼容
	pbkdf2Hash := HashPasswordPBKDF2(password)
	if !VerifyPassword(password, pbkdf2Hash) {
		t.Fatalf("VerifyPassword failed for PBKDF2")
	}

	// 3. 测试 JWT 签发与解析
	dummyUser := &model.User{
		ID:       "usr_test_123",
		Username: "admin_tester",
		Role:     "admin",
	}

	token, err := CreateJWTToken(dummyUser)
	if err != nil {
		t.Fatalf("CreateJWTToken failed: %v", err)
	}

	claims, err := VerifyJWTToken(token)
	if err != nil {
		t.Fatalf("VerifyJWTToken failed: %v", err)
	}

	if claims.Sub != dummyUser.ID || claims.Username != dummyUser.Username || claims.Role != dummyUser.Role {
		t.Fatalf("claims mismatch: %+v", claims)
	}
}
