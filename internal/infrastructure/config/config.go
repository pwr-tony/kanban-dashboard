package config

import (
	"os"
	"time"

	"github.com/go-sql-driver/mysql"
)

type Config struct {
	HTTPPort   string
	DSN        string
	JWTSecret  string
	CORSOrigin string
	StaticDir  string
}

func Load() Config {
	my := mysql.NewConfig()
	my.Net = "tcp"
	my.Addr = env("USERVAR_DB_HOST", "localhost") + ":" + env("USERVAR_DB_PORT", "3306")
	my.User = env("USERVAR_DB_USER", "kanban")
	my.Passwd = env("USERVAR_DB_PASSWORD", "kanban")
	my.DBName = env("USERVAR_DB_NAME", "kanban")
	my.ParseTime = true
	my.Loc = time.UTC
	my.Params = map[string]string{"charset": "utf8mb4"}

	return Config{
		HTTPPort:   env("USERVAR_HTTP_PORT", "8080"),
		DSN:        my.FormatDSN(),
		JWTSecret:  env("USERVAR_JWT_SECRET", "cambia-este-secreto-en-produccion"),
		CORSOrigin: env("USERVAR_CORS_ORIGIN", "*"),
		StaticDir:  env("USERVAR_STATIC_DIR", "frontend"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
