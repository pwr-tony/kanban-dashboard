package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
	"github.com/pwr-tony/kanban-dashboard/internal/domain/user"
)

func respondError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, board.ErrWipLimitReached):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "wip_limit_reached"})
	case errors.Is(err, board.ErrNotFound), errors.Is(err, user.ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, user.ErrEmailTaken):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, user.ErrInvalidCreds):
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
	case isValidationError(err):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error interno del servidor"})
	}
}

func isValidationError(err error) bool {
	for _, v := range []error{
		board.ErrEmptyBoardName, board.ErrEmptyColumnName, board.ErrEmptyCardTitle,
		board.ErrNegativeWipLimit, board.ErrInvalidPriority, board.ErrInvalidPosition,
		board.ErrColumnBoardMismatch, user.ErrEmptyName, user.ErrInvalidEmail,
	} {
		if errors.Is(err, v) {
			return true
		}
	}
	return false
}
