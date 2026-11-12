package service

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"cf_outlook/common"
)

const (
	captchaChars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
	captchaTTL   = 5 * time.Minute
)

func GenerateRandomCode(length int) string {
	if length <= 0 {
		length = 4
	}
	var sb strings.Builder
	maxIdx := big.NewInt(int64(len(captchaChars)))
	for i := 0; i < length; i++ {
		n, _ := rand.Int(rand.Reader, maxIdx)
		sb.WriteByte(captchaChars[n.Int64()])
	}
	return sb.String()
}

func CreateCaptchaToken(code string) (string, error) {
	expiresAt := time.Now().Add(captchaTTL).UnixMilli()
	payload := fmt.Sprintf("%s:%d", strings.ToUpper(code), expiresAt)

	mac := hmac.New(sha256.New, []byte(common.CaptchaSecret))
	mac.Write([]byte(payload))
	signatureHex := hex.EncodeToString(mac.Sum(nil))

	b64Payload := base64.RawURLEncoding.EncodeToString([]byte(payload))
	return fmt.Sprintf("%s.%s", b64Payload, signatureHex), nil
}

func VerifyCaptcha(captchaID, userInput string) (bool, string) {
	if strings.TrimSpace(captchaID) == "" || strings.TrimSpace(userInput) == "" {
		return false, "验证码或凭证不能为空"
	}

	parts := strings.Split(captchaID, ".")
	if len(parts) != 2 {
		return false, "无效的验证码签名凭证"
	}

	b64Payload := parts[0]
	signatureHex := parts[1]

	payloadBytes, err := base64.RawURLEncoding.DecodeString(b64Payload)
	if err != nil {
		return false, "验证码解析错误"
	}

	payloadStr := string(payloadBytes)
	tokens := strings.Split(payloadStr, ":")
	if len(tokens) != 2 {
		return false, "验证码凭证格式错误"
	}

	expectedCode := tokens[0]
	expiresAt, err := strconv.ParseInt(tokens[1], 10, 64)
	if err != nil {
		return false, "验证码时间戳解析错误"
	}

	if time.Now().UnixMilli() > expiresAt {
		return false, "验证码已过期，请点击重新获取"
	}

	mac := hmac.New(sha256.New, []byte(common.CaptchaSecret))
	mac.Write([]byte(payloadStr))
	expectedSigHex := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expectedSigHex), []byte(signatureHex)) {
		return false, "验证码凭证防篡改校验失败"
	}

	if strings.ToUpper(strings.TrimSpace(userInput)) != strings.ToUpper(expectedCode) {
		return false, "验证码输入错误"
	}

	return true, ""
}

// RenderCaptchaSvg 渲染矢量 SVG 验证码图形
func RenderCaptchaSvg(text string, width, height int) string {
	if width <= 0 {
		width = 120
	}
	if height <= 0 {
		height = 40
	}

	colors := []string{"#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706", "#4f46e5"}

	var dots strings.Builder
	for i := 0; i < 20; i++ {
		x, _ := rand.Int(rand.Reader, big.NewInt(int64(width)))
		y, _ := rand.Int(rand.Reader, big.NewInt(int64(height)))
		cIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(colors))))
		dots.WriteString(fmt.Sprintf(`<circle cx="%d" cy="%d" r="1.5" fill="%s" opacity="0.3"/>`, x, y, colors[cIdx.Int64()]))
	}

	var lines strings.Builder
	for i := 0; i < 3; i++ {
		y1, _ := rand.Int(rand.Reader, big.NewInt(int64(height)))
		y2, _ := rand.Int(rand.Reader, big.NewInt(int64(height)))
		cIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(colors))))
		lines.WriteString(fmt.Sprintf(`<path d="M 5 %d Q %d %d %d %d" stroke="%s" stroke-width="1.5" fill="none" opacity="0.45"/>`,
			y1, width/2, height/2, width-5, y2, colors[cIdx.Int64()]))
	}

	charWidth := width / (len(text) + 1)
	var chars strings.Builder
	for i, ch := range text {
		x := (i + 1) * charWidth
		cIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(colors))))
		rot, _ := rand.Int(rand.Reader, big.NewInt(30))
		rotVal := rot.Int64() - 15

		chars.WriteString(fmt.Sprintf(
			`<text x="%d" y="%d" font-family="monospace, sans-serif" font-weight="bold" font-size="22" fill="%s" transform="rotate(%d, %d, %d)" text-anchor="middle">%c</text>`,
			x, height/2+8, colors[cIdx.Int64()], rotVal, x, height/2+8, ch,
		))
	}

	return fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" style="background-color: #f8fafc; border-radius: 6px; user-select: none;">%s%s%s</svg>`,
		width, height, width, height, dots.String(), lines.String(), chars.String(),
	)
}
