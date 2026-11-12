package model

import (
	"encoding/json"
	"testing"
	"time"

	"cf_outlook/common"
)

func setupTestDB(t *testing.T) {
	common.DBDriver = "sqlite"
	common.DBDSN = ":memory:"
	common.GinMode = "release"

	if err := common.InitDB(); err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	if err := InitModel(); err != nil {
		t.Fatalf("InitModel failed: %v", err)
	}
}

func TestModelFullFlow(t *testing.T) {
	setupTestDB(t)
	defer common.CloseDB()

	// 1. 用户计数初始为 0
	cnt, err := GetUserCount()
	if err != nil || cnt != 0 {
		t.Fatalf("expected 0 users, got %d, err: %v", cnt, err)
	}

	// 2. 创建用户
	now := time.Now().UnixMilli()
	u1 := &User{
		ID:           "usr_01",
		Username:     "AdminUser",
		PasswordHash: "hashed_pwd",
		Role:         "admin",
		Status:       "active",
		CreatedAt:    now,
	}
	if err := CreateUser(u1); err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	// 验证大小写不敏感查询
	fetched, err := GetUserByUsername("adminuser")
	if err != nil || fetched.ID != "usr_01" {
		t.Fatalf("GetUserByUsername failed: %+v", fetched)
	}

	// 3. 批量分批导入账号
	accs := []Account{
		{
			ID:           "usr_01_acc1@outlook.com",
			UserID:       "usr_01",
			Email:        "acc1@outlook.com",
			RefreshToken: "rt_1",
			Status:       "idle",
			Tags:         `["主力"]`,
			CreatedAt:    now + 1000,
		},
		{
			ID:           "usr_01_acc2@outlook.com",
			UserID:       "usr_01",
			Email:        "acc2@outlook.com",
			RefreshToken: "rt_2",
			Status:       "idle",
			Tags:         `["备用"]`,
			CreatedAt:    now + 2000,
		},
		{
			ID:           "usr_01_acc3@outlook.com",
			UserID:       "usr_01",
			Email:        "acc3@outlook.com",
			RefreshToken: "rt_3",
			Status:       "idle",
			Tags:         `["OpenAI"]`,
			CreatedAt:    now + 3000,
		},
	}

	saved, err := SaveAccountsBatch(accs)
	if err != nil || saved != 3 {
		t.Fatalf("SaveAccountsBatch failed: saved=%d, err=%v", saved, err)
	}

	// 4. 验证海量数据 Limit / Offset 分页
	// 默认按 created_at desc 排序，因此 acc3 (now+3000) 应该排第一
	page1, err := ListAccountsByUser("usr_01", 2, 0)
	if err != nil || len(page1) != 2 {
		t.Fatalf("Page 1 failed, len=%d, err=%v", len(page1), err)
	}
	if page1[0].Email != "acc3@outlook.com" || page1[1].Email != "acc2@outlook.com" {
		t.Fatalf("Page 1 sort order incorrect: %+v", page1)
	}

	page2, err := ListAccountsByUser("usr_01", 2, 2)
	if err != nil || len(page2) != 1 {
		t.Fatalf("Page 2 failed, len=%d, err=%v", len(page2), err)
	}
	if page2[0].Email != "acc1@outlook.com" {
		t.Fatalf("Page 2 item mismatch: %+v", page2)
	}

	// 5. 验证标签修改
	newTags := []string{"测试", "已修改"}
	if err := UpdateAccountTags("usr_01", "usr_01_acc1@outlook.com", newTags); err != nil {
		t.Fatalf("UpdateAccountTags failed: %v", err)
	}
	updatedAcc, _ := GetAccountByID("usr_01", "usr_01_acc1@outlook.com")
	var parsedTags []string
	_ = json.Unmarshal([]byte(updatedAcc.Tags), &parsedTags)
	if len(parsedTags) != 2 || parsedTags[0] != "测试" {
		t.Fatalf("tags update mismatch: %+v", parsedTags)
	}

	// 6. 验证邮件存储与筛选
	codeVal := "654321"
	emails := []Email{
		{
			ID:            "em_01",
			UserID:        "usr_01",
			AccountEmail:  "acc1@outlook.com",
			Subject:       "Security Notification",
			SenderName:    "Microsoft",
			SenderAddress: "security@microsoft.com",
			ReceivedAt:    "2026-11-12T10:00:00Z",
			BodyPreview:   "Your code is 654321",
			ExtractedCode: &codeVal,
			IsJunk:        0,
			IsRead:        0,
		},
	}
	if err := SaveEmailsBatch(emails); err != nil {
		t.Fatalf("SaveEmailsBatch failed: %v", err)
	}

	// 查询带验证码的邮件
	foundEmails, err := ListEmails("usr_01", EmailQueryOptions{HasCode: true})
	if err != nil || len(foundEmails) != 1 {
		t.Fatalf("ListEmails failed: %v, count: %d", err, len(foundEmails))
	}

	// 标记已读
	if err := UpdateEmailReadStatus("usr_01", "em_01", true); err != nil {
		t.Fatalf("UpdateEmailReadStatus failed: %v", err)
	}

	// 7. 验证级联删除
	if err := DeleteUserAndData("usr_01"); err != nil {
		t.Fatalf("DeleteUserAndData failed: %v", err)
	}

	remAccounts, _ := ListAccountsByUser("usr_01", 0, 0)
	if len(remAccounts) != 0 {
		t.Fatalf("expected accounts cleaned up after user deletion")
	}
}
