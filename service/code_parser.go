package service

import (
	"regexp"
	"strconv"
	"strings"
)

var keywords = []string{
	"验证码", "动态码", "校验码", "安全码", "确认码",
	"verification code", "verify code", "security code", "confirmation code",
	"one-time passcode", "one-time password", "passcode", "otp", "pin",
	"auth code", "access code",
}

var stopWords = map[string]struct{}{
	"here": {}, "your": {}, "this": {}, "from": {}, "with": {}, "have": {}, "when": {}, "what": {}, "then": {},
	"some": {}, "into": {}, "only": {}, "also": {}, "more": {}, "mail": {}, "team": {}, "code": {}, "help": {},
	"user": {}, "pass": {}, "view": {}, "click": {}, "open": {}, "send": {}, "sent": {}, "read": {}, "free": {},
}

var explicitRegexes = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(?:验证码|动态码|校验码|安全码|确认码|otp|passcode|pin)(?:\s+is|\s*为|\s*是)?[:：\t ]*([A-Za-z0-9]{4,8})\b`),
	regexp.MustCompile(`(?i)(?:verification|confirmation|security|auth|access|guard)\s+code(?:\s+is)?[:：\t ]*([A-Za-z0-9]{4,8})\b`),
	regexp.MustCompile(`(?i)(?:enter|use|with)\s+(?:code|pin)[:：\t ]*([A-Za-z0-9]{4,8})\b`),
	regexp.MustCompile(`(?i)【.+】.*?([0-9]{4,8})`),
	regexp.MustCompile(`(?i)([0-9]{4,8})\s*(?:为您的|是您的|是本次)`),
	regexp.MustCompile(`(?i)(?:code|pin)[:：\t ]+([A-Za-z0-9]{4,8})\b`),
}

var htmlPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)<(?:span|strong|b|div|p|td|h[1-6])[^>]*style="[^"]*(?:font-size:\s*(?:[2-4]\d|1[89])px|letter-spacing)[^"]*"[^>]*>\s*([A-Za-z0-9]{4,8})\s*<`),
	regexp.MustCompile(`(?i)<(?:span|strong|b|h[1-4])[^>]*>\s*([0-9]{4,8})\s*<`),
}

var numberRegex = regexp.MustCompile(`\b([0-9]{4,8})\b`)
var fourDigitsRegex = regexp.MustCompile(`^[0-9]{4}$`)

func ExtractVerificationCode(subject, bodyPreview, bodyHTML string) string {
	textToScan := subject + "\n" + bodyPreview

	// 1. 显式的单行关键词后跟随验证码
	for _, reg := range explicitRegexes {
		match := reg.FindStringSubmatch(textToScan)
		if len(match) > 1 {
			code := strings.TrimSpace(match[1])
			if isValidCandidate(code) {
				return code
			}
		}
	}

	// 2. 从 HTML 中分析特殊标签 (大号字号/加粗代码)
	if bodyHTML != "" {
		for _, reg := range htmlPatterns {
			match := reg.FindStringSubmatch(bodyHTML)
			if len(match) > 1 {
				code := strings.TrimSpace(match[1])
				if isValidCandidate(code) {
					return code
				}
			}
		}
	}

	// 3. 如果标题或正文提示了关键词，提取独立的 4-8 位纯数字
	hasKeyword := false
	lowerText := strings.ToLower(textToScan)
	for _, kw := range keywords {
		if strings.Contains(lowerText, strings.ToLower(kw)) {
			hasKeyword = true
			break
		}
	}

	if hasKeyword {
		matches := numberRegex.FindAllStringSubmatch(textToScan, -1)
		for _, m := range matches {
			if len(m) > 1 {
				code := strings.TrimSpace(m[1])
				if isValidCandidate(code) {
					return code
				}
			}
		}
	}

	return ""
}

func isValidCandidate(val string) bool {
	if len(val) < 4 || len(val) > 8 {
		return false
	}

	// 过滤英语常用停用词
	if _, ok := stopWords[strings.ToLower(val)]; ok {
		return false
	}

	// 避免误判年份 (1990 - 2035)
	if fourDigitsRegex.MatchString(val) {
		if year, err := strconv.Atoi(val); err == nil {
			if year >= 1990 && year <= 2035 {
				return false
			}
		}
	}

	return true
}
