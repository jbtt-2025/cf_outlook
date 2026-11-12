package router

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"cf_outlook/common"
	"cf_outlook/model"
	"cf_outlook/service"
)

func setupTestRouter(t *testing.T) http.Handler {
	common.DBDriver = "sqlite"
	common.DBDSN = ":memory:"
	common.GinMode = "release"

	if err := common.InitDB(); err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	if err := model.InitModel(); err != nil {
		t.Fatalf("InitModel failed: %v", err)
	}

	return SetupRouter(nil)
}

func TestAPIIntegration(t *testing.T) {
	app := setupTestRouter(t)
	defer common.CloseDB()

	// 1. 测试 GET /api/auth/status
	req := httptest.NewRequest("GET", "/api/auth/status", nil)
	w := httptest.NewRecorder()
	app.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status code = %d", w.Code)
	}

	var statusRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &statusRes)
	if statusRes["has_admin"] != false || statusRes["db_ready"] != true {
		t.Fatalf("unexpected status: %+v", statusRes)
	}

	// 2. 测试 GET /api/auth/captcha
	req = httptest.NewRequest("GET", "/api/auth/captcha", nil)
	w = httptest.NewRecorder()
	app.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("captcha code = %d", w.Code)
	}

	// 3. 构造验证码并注册首位管理员
	testCode := "9876"
	testCaptchaID, _ := service.CreateCaptchaToken(testCode)

	regPayload := map[string]string{
		"username":     "SuperAdmin",
		"password":     "AdminPass123!",
		"captcha_id":   testCaptchaID,
		"captcha_code": testCode,
	}
	regBytes, _ := json.Marshal(regPayload)
	req = httptest.NewRequest("POST", "/api/auth/register", bytes.NewReader(regBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("register failed, code = %d, body = %s", w.Code, w.Body.String())
	}

	var regRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &regRes)
	token, ok := regRes["token"].(string)
	if !ok || token == "" {
		t.Fatalf("token missing in register response: %+v", regRes)
	}

	// 4. 测试需要认证的 GET /api/auth/me
	req = httptest.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("get me failed, code = %d", w.Code)
	}

	// 5. 测试批量导入 POST /api/accounts/import
	importPayload := map[string]interface{}{
		"accounts": []map[string]interface{}{
			{
				"email":         "user1@outlook.com",
				"refresh_token": "rt_mock_1",
				"tags":          []string{"主力", "重要"},
			},
			{
				"email":         "user2@outlook.com",
				"refresh_token": "rt_mock_2",
				"tags":          []string{"备用"},
			},
		},
	}
	impBytes, _ := json.Marshal(importPayload)
	req = httptest.NewRequest("POST", "/api/accounts/import", bytes.NewReader(impBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("import failed, code = %d, body = %s", w.Code, w.Body.String())
	}

	// 6. 测试账号查询 GET /api/accounts
	req = httptest.NewRequest("GET", "/api/accounts", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	app.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("list accounts failed, code = %d", w.Code)
	}

	var accListRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &accListRes)
	accs, _ := accListRes["accounts"].([]interface{})
	if len(accs) != 2 {
		t.Fatalf("expected 2 accounts, got %d", len(accs))
	}
}
