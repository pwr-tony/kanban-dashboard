package config

import (
	"fmt"
	"os"
)

type Config struct {
	HTTPPort   string
	DSN        string
	JWTSecret  string
	CORSOrigin string
}

func Load() Config {
	dbUser := env("DB_USER", "kanban")
	dbPass := env("DB_PASSWORD", "kanban")
	dbHost := env("DB_HOST", "localhost")
	dbPort := env("DB_PORT", "3306")
	dbName := env("DB_NAME", "kanban")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=UTC",
		dbUser, dbPass, dbHost, dbPort, dbName)

	return Config{
		HTTPPort:   env("HTTP_PORT", "8080"),
		DSN:        dsn,
		JWTSecret:  env("JWT_SECRET", "cambia-este-secreto-en-produccion"),
		CORSOrigin: env("CORS_ORIGIN", "*"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
