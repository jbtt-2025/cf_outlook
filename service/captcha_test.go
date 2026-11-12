package service

import (
	"strings"
	"testing"
)

func TestCaptchaFlow(t *testing.T) {
	code := GenerateRandomCode(4)
	if len(code) != 4 {
		t.Fatalf("expected 4 chars, got %d", len(code))
	}

	token, err := CreateCaptchaToken(code)
	if err != nil {
		t.Fatalf("CreateCaptchaToken failed: %v", err)
	}

	// 验证正确输入
	valid, reason := VerifyCaptcha(token, code)
	if !valid {
		t.Fatalf("expected valid captcha, got false: %s", reason)
	}

	// 验证忽略大小写
	validLower, _ := VerifyCaptcha(token, strings.ToLower(code))
	if !validLower {
		t.Fatalf("expected case-insensitive match")
	}

	// 验证错误输入
	validWrong, _ := VerifyCaptcha(token, "WRONG")
	if validWrong {
		t.Fatalf("expected wrong captcha to fail")
	}

	// 验证防篡改
	tamperedToken := token + "tampered"
	validTampered, _ := VerifyCaptcha(tamperedToken, code)
	if validTampered {
		t.Fatalf("expected tampered token to fail")
	}

	// 验证 SVG 输出
	svg := RenderCaptchaSvg(code, 120, 40)
	if !strings.HasPrefix(svg, "<svg") || !strings.HasSuffix(svg, "</svg>") {
		t.Fatalf("invalid SVG format: %s", svg)
	}
}
