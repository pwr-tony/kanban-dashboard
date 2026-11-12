package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type boardRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type columnRequest struct {
	Name     string `json:"name"`
	Position int    `json:"position"`
	WipLimit int    `json:"wip_limit"`
}

type labelRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

func (h *Handlers) ListBoards(c *gin.Context) {
	boards, err := h.boards.List(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	out := make([]boardResponse, 0, len(boards))
	for _, b := range boards {
		out = append(out, toBoard(b))
	}
	c.JSON(http.StatusOK, out)
}

func (h *Handlers) CreateBoard(c *gin.Context) {
	var req boardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	b, err := h.boards.Create(c.Request.Context(), req.Name, req.Description)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toBoard(b))
}

func (h *Handlers) GetBoard(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	detail, err := h.boards.Get(c.Request.Context(), id)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toBoardDetail(detail))
}

func (h *Handlers) UpdateBoard(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req boardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	b, err := h.boards.Update(c.Request.Context(), id, req.Name, req.Description)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toBoard(b))
}

func (h *Handlers) DeleteBoard(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	if err := h.boards.Delete(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handlers) CreateColumn(c *gin.Context) {
	boardID, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req columnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	col, err := h.boards.CreateColumn(c.Request.Context(), boardID, req.Name, req.Position, req.WipLimit)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toColumn(col))
}

func (h *Handlers) UpdateColumn(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req columnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	col, err := h.boards.UpdateColumn(c.Request.Context(), id, req.Name, req.Position, req.WipLimit)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toColumn(col))
}

func (h *Handlers) CreateLabel(c *gin.Context) {
	boardID, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req labelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	l, err := h.boards.CreateLabel(c.Request.Context(), boardID, req.Name, req.Color)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toLabel(l))
}

func (h *Handlers) DeleteLabel(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	if err := h.boards.DeleteLabel(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
