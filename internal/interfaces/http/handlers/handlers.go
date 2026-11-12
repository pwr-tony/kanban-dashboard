package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"kanban/internal/application"
)

type Handlers struct {
	boards  *application.BoardService
	cards   *application.CardService
	metrics *application.MetricsService
	auth    *application.AuthService
}

func New(
	boards *application.BoardService,
	cards *application.CardService,
	metrics *application.MetricsService,
	auth *application.AuthService,
) *Handlers {
	return &Handlers{boards: boards, cards: cards, metrics: metrics, auth: auth}
}

func (h *Handlers) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func pathID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return 0, false
	}
	return id, true
}

func queryID(c *gin.Context, name string) int64 {
	id, err := strconv.ParseInt(c.Query(name), 10, 64)
	if err != nil {
		return 0
	}
	return id
}
