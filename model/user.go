package model

import (
	"strings"

	"cf_outlook/common"
	"gorm.io/gorm"
)

type User struct {
	ID           string `gorm:"type:varchar(64);primaryKey" json:"id"`
	Username     string `gorm:"type:varchar(64);uniqueIndex;not null" json:"username"`
	PasswordHash string `gorm:"type:varchar(255);not null" json:"-"`
	Role         string `gorm:"type:varchar(16);default:'user';not null" json:"role"`     // 'admin' | 'user'
	Status       string `gorm:"type:varchar(16);default:'active';not null" json:"status"` // 'active' | 'disabled'
	CreatedAt    int64  `gorm:"index;not null" json:"created_at"`
	LastLoginAt  *int64 `json:"last_login_at,omitempty"`
}

type UserWithStats struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	Role         string `json:"role"`
	Status       string `json:"status"`
	CreatedAt    int64  `json:"created_at"`
	LastLoginAt  *int64 `json:"last_login_at,omitempty"`
	AccountCount int64  `json:"account_count"`
}

func (User) TableName() string {
	return "users"
}

func GetUserCount() (int64, error) {
	var count int64
	err := common.DB.Model(&User{}).Count(&count).Error
	return count, err
}

func GetUserByUsername(username string) (*User, error) {
	var user User
	cleanName := strings.ToLower(strings.TrimSpace(username))
	err := common.DB.Where("LOWER(username) = ?", cleanName).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserByID(id string) (*User, error) {
	var user User
	err := common.DB.Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func CreateUser(user *User) error {
	user.Username = strings.ToLower(strings.TrimSpace(user.Username))
	return common.DB.Create(user).Error
}

func ListAllUsers() ([]UserWithStats, error) {
	var users []User
	if err := common.DB.Order("created_at asc").Find(&users).Error; err != nil {
		return nil, err
	}

	result := make([]UserWithStats, 0, len(users))
	for _, u := range users {
		var accCount int64
		common.DB.Model(&Account{}).Where("user_id = ?", u.ID).Count(&accCount)

		result = append(result, UserWithStats{
			ID:           u.ID,
			Username:     u.Username,
			Role:         u.Role,
			Status:       u.Status,
			CreatedAt:    u.CreatedAt,
			LastLoginAt:  u.LastLoginAt,
			AccountCount: accCount,
		})
	}

	return result, nil
}

func UpdateUser(id string, updates map[string]interface{}) error {
	return common.DB.Model(&User{}).Where("id = ?", id).Updates(updates).Error
}

func DeleteUserAndData(id string) error {
	return common.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", id).Delete(&Email{}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", id).Delete(&Account{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", id).Delete(&User{}).Error; err != nil {
			return err
		}
		return nil
	})
}
