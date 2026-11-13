package main

import (
	"context"
	"log"

	"github.com/joho/godotenv"
	"kanban/internal/application"
	"kanban/internal/infrastructure/auth"
	"kanban/internal/infrastructure/config"
	"kanban/internal/infrastructure/crypto"
	"kanban/internal/infrastructure/persistence/mysql"
	httpapi "kanban/internal/interfaces/http"
	"kanban/internal/interfaces/http/handlers"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	keys, err := crypto.NewKeyring(crypto.KeyringConfig{
		ActiveID:      cfg.KEKID,
		ActiveKEK:     cfg.KEK,
		RetiredKEKs:   cfg.KEKRetired,
		BlindIndexKey: cfg.BlindIndexKey,
	})
	if err != nil {
		log.Fatalf("llaves de cifrado: %v (genera una con: openssl rand -base64 32)", err)
	}

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
	userRepo := mysql.NewUserRepository(db, keys)

	ctx := context.Background()
	if n, err := userRepo.EncryptLegacyRows(ctx); err != nil {
		log.Fatalf("cifrando usuarios existentes: %v", err)
	} else if n > 0 {
		log.Printf("cifrados %d usuarios que estaban en claro", n)
	}
	if n, err := userRepo.RewrapRetiredKEKs(ctx); err != nil {
		log.Fatalf("rotando KEK: %v", err)
	} else if n > 0 {
		log.Printf("re-envueltas %d DEKs con la KEK %q", n, keys.ActiveKEKID())
	}

	hasher := auth.NewBcryptHasher()
	issuer := auth.NewJWTIssuer(cfg.JWTSecret)

	boardService := application.NewBoardService(boardRepo, columnRepo, cardRepo, labelRepo)
	cardService := application.NewCardService(cardRepo, columnRepo, movementRepo)
	metricsService := application.NewMetricsService(boardRepo, columnRepo, cardRepo, movementRepo)
	authService := application.NewAuthService(userRepo, hasher, issuer)

	h := handlers.New(boardService, cardService, metricsService, authService)
	router := httpapi.NewRouter(h, issuer, cfg.CORSOrigin, cfg.StaticDir)

	log.Printf("API escuchando en :%s", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatalf("servidor: %v", err)
	}
}
