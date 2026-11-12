package service

import (
	"testing"
)

func TestExtractVerificationCode(t *testing.T) {
	tests := []struct {
		name        string
		subject     string
		bodyPreview string
		bodyHTML    string
		expected    string
	}{
		{
			name:        "Standard Chinese verification code",
			subject:     "您的验证码是 482910，请在10分钟内输入",
			bodyPreview: "请勿将此验证码告知他人",
			expected:    "482910",
		},
		{
			name:        "English OTP verification code",
			subject:     "Your one-time passcode is 928371",
			bodyPreview: "Use this OTP to complete login",
			expected:    "928371",
		},
		{
			name:        "HTML styled verification code",
			subject:     "安全通知",
			bodyPreview: "",
			bodyHTML:    `<div style="font-size: 24px; color: red;"> 582019 </div>`,
			expected:    "582019",
		},
		{
			name:        "Verification code with colons and spaces",
			subject:     "登录校验",
			bodyPreview: "auth code:  716294",
			expected:    "716294",
		},
		{
			name:        "Avoid false positive of current year 2026",
			subject:     "Welcome to 2026 Annual Report",
			bodyPreview: "Thank you for joining our 2026 newsletter",
			expected:    "",
		},
		{
			name:        "Alphanumeric verification code",
			subject:     "Steam Guard code: X9K2P4",
			bodyPreview: "Enter this code to authorize new device",
			expected:    "X9K2P4",
		},
		{
			name:        "Chinese bracket notification format",
			subject:     "【腾讯云】您的验证码为 839102，5分钟内有效",
			bodyPreview: "工作人员不会向您索取验证码",
			expected:    "839102",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractVerificationCode(tt.subject, tt.bodyPreview, tt.bodyHTML)
			if got != tt.expected {
				t.Errorf("ExtractVerificationCode() = %v, want %v", got, tt.expected)
			}
		})
	}
}
