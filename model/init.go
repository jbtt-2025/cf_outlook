package model

import (
	"log"

	"cf_outlook/common"
)

func InitModel() error {
	err := common.DB.AutoMigrate(
		&User{},
		&Account{},
		&Email{},
	)
	if err != nil {
		log.Printf("[DB] AutoMigrate error: %v", err)
		return err
	}

	log.Printf("[DB] AutoMigrate completed successfully for User, Account, Email")
	return nil
}
