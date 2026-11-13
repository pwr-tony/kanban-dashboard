package main

import (
	"log"

	"github.com/joho/godotenv"
	"kanban/internal/application"
	"kanban/internal/infrastructure/auth"
	"kanban/internal/infrastructure/config"
	"kanban/internal/infrastructure/persistence/mysql"
	httpapi "kanban/internal/interfaces/http"
	"kanban/internal/interfaces/http/handlers"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	db, err := mysql.Connect(cfg.DSN)
	if err != nil {
		log.Fatalf("base de datos: %v", err)
	}
	defer db.Close()

	boardRepo := mysql.NewBoardRepository(db)
	columnRepo := mysql.NewColumnRepository(db)
	cardRepo := mysql.NewCardRepository(db)
	labelRepo := mysql.NewLabelRepository(db)
	movementRepo := mysql.NewMovementRepository(db)
	userRepo := mysql.NewUserRepository(db)

	hasher := auth.NewBcryptHasher()
	issuer := auth.NewJWTIssuer(cfg.JWTSecret)

	boardService := application.NewBoardService(boardRepo, columnRepo, cardRepo, labelRepo)
	cardService := application.NewCardService(cardRepo, columnRepo, movementRepo)
	metricsService := application.NewMetricsService(boardRepo, columnRepo, cardRepo, movementRepo)
	authService := application.NewAuthService(userRepo, hasher, issuer)

	h := handlers.New(boardService, cardService, metricsService, authService)
	router := httpapi.NewRouter(h, issuer, cfg.CORSOrigin)

	log.Printf("API escuchando en :%s", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatalf("servidor: %v", err)
	}
}
