package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"kanban/internal/application"
)

type createCardRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Priority    string  `json:"priority"`
	AssigneeID  *int64  `json:"assignee_id"`
	LabelIDs    []int64 `json:"label_ids"`
}

type updateCardRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Priority    string  `json:"priority"`
	AssigneeID  *int64  `json:"assignee_id"`
	LabelIDs    []int64 `json:"label_ids"`
}

type moveCardRequest struct {
	ColumnID int64 `json:"column_id"`
}

func (h *Handlers) CreateCard(c *gin.Context) {
	columnID, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req createCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	card, err := h.cards.Create(c.Request.Context(), application.CreateCardInput{
		ColumnID:    columnID,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssigneeID:  req.AssigneeID,
		LabelIDs:    req.LabelIDs,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toCard(card))
}

func (h *Handlers) UpdateCard(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req updateCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	card, err := h.cards.Update(c.Request.Context(), id, application.UpdateCardInput{
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		AssigneeID:  req.AssigneeID,
		LabelIDs:    req.LabelIDs,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toCard(card))
}

func (h *Handlers) MoveCard(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	var req moveCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido"})
		return
	}
	card, err := h.cards.Move(c.Request.Context(), id, req.ColumnID)
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toCard(card))
}

func (h *Handlers) DeleteCard(c *gin.Context) {
	id, ok := pathID(c, "id")
	if !ok {
		return
	}
	if err := h.cards.Delete(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
