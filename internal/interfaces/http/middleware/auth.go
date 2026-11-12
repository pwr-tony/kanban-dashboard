package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/pwr-tony/kanban-dashboard/internal/infrastructure/auth"
)

func RequireAuth(issuer auth.JWTIssuer) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "falta el token de autenticación"})
			return
		}
		token := strings.TrimPrefix(header, "Bearer ")
		userID, email, err := issuer.Parse(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token inválido o expirado"})
			return
		}
		c.Set("user_id", userID)
		c.Set("user_email", email)
		c.Next()
	}
}
