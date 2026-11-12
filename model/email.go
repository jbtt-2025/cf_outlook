package model

import (
	"strings"

	"cf_outlook/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Email struct {
	ID            string  `gorm:"type:varchar(191);primaryKey" json:"id"`
	UserID        string  `gorm:"type:varchar(64);not null;index:idx_em_user_recv,priority:1;index:idx_em_user_acc_recv,priority:1" json:"user_id"`
	AccountEmail  string  `gorm:"type:varchar(191);not null;index:idx_em_user_acc_recv,priority:2" json:"account_email"`
	Subject       string  `gorm:"type:varchar(512)" json:"subject"`
	SenderName    string  `gorm:"type:varchar(255)" json:"sender_name"`
	SenderAddress string  `gorm:"type:varchar(255)" json:"sender_address"`
	ReceivedAt    string  `gorm:"type:varchar(64);not null;index:idx_em_user_recv,priority:2;index:idx_em_user_acc_recv,priority:3" json:"received_at"`
	BodyPreview   string  `gorm:"type:text" json:"body_preview"`
	BodyHTML      string  `gorm:"type:longtext" json:"body_html,omitempty"`
	ExtractedCode *string `gorm:"type:varchar(64);index" json:"extracted_code,omitempty"`
	IsJunk        int     `gorm:"default:0;index" json:"is_junk"`
	IsRead        int     `gorm:"default:0;index" json:"is_read"`
	RawHeaders    *string `gorm:"type:longtext" json:"raw_headers,omitempty"`
}

type EmailQueryOptions struct {
	AccountEmail *string
	IsJunk       *bool
	HasCode      bool
	UnreadOnly   bool
	Search       *string
	Limit        int
	Offset       int
}

func (Email) TableName() string {
	return "emails"
}

func ListEmails(userID string, opts EmailQueryOptions) ([]Email, error) {
	var list []Email
	query := common.DB.Where("user_id = ?", userID)

	if opts.AccountEmail != nil && *opts.AccountEmail != "" {
		query = query.Where("LOWER(account_email) = ?", strings.ToLower(strings.TrimSpace(*opts.AccountEmail)))
	}

	if opts.IsJunk != nil {
		junkVal := 0
		if *opts.IsJunk {
			junkVal = 1
		}
		query = query.Where("is_junk = ?", junkVal)
	}

	if opts.HasCode {
		query = query.Where("extracted_code IS NOT NULL AND extracted_code != ''")
	}

	if opts.UnreadOnly {
		query = query.Where("is_read = 0")
	}

	if opts.Search != nil && strings.TrimSpace(*opts.Search) != "" {
		s := "%" + strings.ToLower(strings.TrimSpace(*opts.Search)) + "%"
		query = query.Where(
			"LOWER(subject) LIKE ? OR LOWER(sender_name) LIKE ? OR LOWER(sender_address) LIKE ? OR LOWER(body_preview) LIKE ? OR LOWER(extracted_code) LIKE ?",
			s, s, s, s, s,
		)
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	query = query.Order("received_at desc").Limit(limit)
	if opts.Offset > 0 {
		query = query.Offset(opts.Offset)
	}

	err := query.Find(&list).Error
	return list, err
}

func SaveEmailsBatch(emails []Email) error {
	if len(emails) == 0 {
		return nil
	}

	const chunkSize = 50
	return common.DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < len(emails); i += chunkSize {
			end := i + chunkSize
			if end > len(emails) {
				end = len(emails)
			}
			chunk := emails[i:end]

			err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{
					"subject",
					"body_preview",
					"body_html",
					"extracted_code",
				}),
			}).Create(&chunk).Error

			if err != nil {
				return err
			}
		}
		return nil
	})
}

func UpdateEmailReadStatus(userID, emailID string, isRead bool) error {
	readVal := 0
	if isRead {
		readVal = 1
	}
	return common.DB.Model(&Email{}).
		Where("id = ? AND user_id = ?", emailID, userID).
		Update("is_read", readVal).Error
}

func DeleteEmail(userID, emailID string) error {
	return common.DB.Where("id = ? AND user_id = ?", emailID, userID).Delete(&Email{}).Error
}
