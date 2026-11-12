package model

import (
	"encoding/json"
	"strings"

	"cf_outlook/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Account struct {
	ID             string  `gorm:"type:varchar(191);primaryKey" json:"id"`
	UserID         string  `gorm:"type:varchar(64);not null;index:idx_acc_user_created,priority:1" json:"user_id"`
	Email          string  `gorm:"type:varchar(191);not null;index" json:"email"`
	Password       *string `gorm:"type:varchar(255)" json:"password,omitempty"`
	RefreshToken   string  `gorm:"type:text;not null" json:"refresh_token"`
	ClientID       *string `gorm:"type:varchar(128)" json:"client_id,omitempty"`
	Status         string  `gorm:"type:varchar(32);default:'idle';not null;index" json:"status"`
	DeadReason     *string `gorm:"type:text" json:"dead_reason,omitempty"`
	RateLimitUntil *int64  `json:"rate_limit_until,omitempty"`
	LastCheckedAt  *int64  `json:"last_checked_at,omitempty"`
	UnreadCount    int     `gorm:"default:0" json:"unread_count"`
	LatestCode     *string `gorm:"type:varchar(64)" json:"latest_code,omitempty"`
	LatestCodeTime *string `gorm:"type:varchar(64)" json:"latest_code_time,omitempty"`
	Tags           string  `gorm:"type:text" json:"tags"` // JSON string
	CreatedAt      int64   `gorm:"not null;index:idx_acc_user_created,priority:2" json:"created_at"`
}

func (Account) TableName() string {
	return "accounts"
}

func ListAccountsByUser(userID string, limit, offset int) ([]Account, error) {
	var list []Account
	query := common.DB.Where("user_id = ?", userID).Order("created_at desc")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}
	err := query.Find(&list).Error
	return list, err
}

func GetAccountByID(userID, accountID string) (*Account, error) {
	var acc Account
	err := common.DB.Where("id = ? AND user_id = ?", accountID, userID).First(&acc).Error
	if err != nil {
		return nil, err
	}
	return &acc, nil
}

// SaveAccountsBatch 批量分批导入账号 (50条/批，原子 UPSERT 兼顾 MySQL 5.7/8, Postgres, SQLite)
func SaveAccountsBatch(accounts []Account) (int64, error) {
	if len(accounts) == 0 {
		return 0, nil
	}

	const chunkSize = 50
	var totalSaved int64

	err := common.DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < len(accounts); i += chunkSize {
			end := i + chunkSize
			if end > len(accounts) {
				end = len(accounts)
			}
			chunk := accounts[i:end]

			err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{
					"refresh_token",
					"password",
					"client_id",
					"status",
					"dead_reason",
					"rate_limit_until",
					"last_checked_at",
					"unread_count",
					"latest_code",
					"latest_code_time",
					"tags",
				}),
			}).Create(&chunk).Error

			if err != nil {
				return err
			}
			totalSaved += int64(len(chunk))
		}
		return nil
	})

	return totalSaved, err
}

func UpdateAccountTags(userID, accountID string, tags []string) error {
	cleanTags := make([]string, 0, len(tags))
	for _, t := range tags {
		trimmed := strings.TrimSpace(t)
		if trimmed != "" {
			cleanTags = append(cleanTags, trimmed)
		}
	}
	bytes, _ := json.Marshal(cleanTags)
	return common.DB.Model(&Account{}).
		Where("id = ? AND user_id = ?", accountID, userID).
		Update("tags", string(bytes)).Error
}

func UpdateAccountSyncResult(accountID string, updates map[string]interface{}) error {
	return common.DB.Model(&Account{}).Where("id = ?", accountID).Updates(updates).Error
}

func DeleteAccount(userID, accountID string) error {
	return common.DB.Transaction(func(tx *gorm.DB) error {
		var acc Account
		if err := tx.Where("id = ? AND user_id = ?", accountID, userID).First(&acc).Error; err == nil {
			// 同步删除该账号的所有邮件缓存
			_ = tx.Where("user_id = ? AND LOWER(account_email) = ?", userID, strings.ToLower(acc.Email)).Delete(&Email{}).Error
		}
		return tx.Where("id = ? AND user_id = ?", accountID, userID).Delete(&Account{}).Error
	})
}

func PurgeDeadAccounts(userID string) (int64, error) {
	res := common.DB.Where("user_id = ? AND status = 'dead'", userID).Delete(&Account{})
	return res.RowsAffected, res.Error
}
