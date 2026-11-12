package http

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/pwr-tony/kanban-dashboard/internal/infrastructure/auth"
	"github.com/pwr-tony/kanban-dashboard/internal/interfaces/http/handlers"
	"github.com/pwr-tony/kanban-dashboard/internal/interfaces/http/middleware"
)

func NewRouter(h *handlers.Handlers, issuer auth.JWTIssuer, corsOrigin string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
	if corsOrigin == "*" {
		corsConfig.AllowAllOrigins = true
		corsConfig.AllowCredentials = false
	} else {
		corsConfig.AllowOrigins = []string{corsOrigin}
	}
	r.Use(cors.New(corsConfig))

	r.GET("/health", h.Health)

	r.POST("/auth/register", h.Register)
	r.POST("/auth/login", h.Login)

	api := r.Group("/")
	api.Use(middleware.RequireAuth(issuer))
	{
		api.GET("/users", h.ListUsers)

		api.GET("/boards", h.ListBoards)
		api.POST("/boards", h.CreateBoard)
		api.GET("/boards/:id", h.GetBoard)
		api.PUT("/boards/:id", h.UpdateBoard)
		api.DELETE("/boards/:id", h.DeleteBoard)
		api.GET("/boards/:id/metrics", h.GetMetrics)

		api.POST("/boards/:id/columns", h.CreateColumn)
		api.POST("/boards/:id/labels", h.CreateLabel)

		api.PUT("/columns/:id", h.UpdateColumn)

		api.POST("/columns/:id/cards", h.CreateCard)
		api.PUT("/cards/:id", h.UpdateCard)
		api.POST("/cards/:id/move", h.MoveCard)
		api.DELETE("/cards/:id", h.DeleteCard)

		api.DELETE("/labels/:id", h.DeleteLabel)
	}

	return r
}
