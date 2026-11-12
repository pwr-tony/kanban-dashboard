package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handlers) GetMetrics(c *gin.Context) {
	boardID, ok := pathID(c, "id")
	if !ok {
		return
	}
	start := queryID(c, "start_column_id")
	done := queryID(c, "done_column_id")

	m, err := h.metrics.Get(c.Request.Context(), boardID, start, done)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, m)
}
