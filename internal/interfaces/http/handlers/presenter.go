package handlers

import (
	"time"

	"kanban/internal/application"
	"kanban/internal/domain/board"
	"kanban/internal/domain/user"
)

type boardResponse struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type columnResponse struct {
	ID       int64  `json:"id"`
	BoardID  int64  `json:"board_id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
	WipLimit int    `json:"wip_limit"`
}

type cardResponse struct {
	ID          int64     `json:"id"`
	BoardID     int64     `json:"board_id"`
	ColumnID    int64     `json:"column_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Priority    string    `json:"priority"`
	AssigneeID  *int64    `json:"assignee_id"`
	Position    int       `json:"position"`
	LabelIDs    []int64   `json:"label_ids"`
	CreatedAt   time.Time `json:"created_at"`
}

type labelResponse struct {
	ID      int64  `json:"id"`
	BoardID int64  `json:"board_id"`
	Name    string `json:"name"`
	Color   string `json:"color"`
}

type userResponse struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type boardDetailResponse struct {
	boardResponse
	Columns []columnResponse `json:"columns"`
	Cards   []cardResponse   `json:"cards"`
	Labels  []labelResponse  `json:"labels"`
}

func toBoard(b *board.Board) boardResponse {
	return boardResponse{ID: b.ID, Name: b.Name, Description: b.Description, CreatedAt: b.CreatedAt}
}

func toColumn(c *board.Column) columnResponse {
	return columnResponse{
		ID: c.ID, BoardID: c.BoardID, Name: c.Name,
		Position: c.Position, WipLimit: c.WipLimit.Value(),
	}
}

func toCard(c *board.Card) cardResponse {
	labels := c.LabelIDs
	if labels == nil {
		labels = []int64{}
	}
	return cardResponse{
		ID: c.ID, BoardID: c.BoardID, ColumnID: c.ColumnID, Title: c.Title,
		Description: c.Description, Priority: c.Priority.String(), AssigneeID: c.AssigneeID,
		Position: c.Position, LabelIDs: labels, CreatedAt: c.CreatedAt,
	}
}

func toLabel(l *board.Label) labelResponse {
	return labelResponse{ID: l.ID, BoardID: l.BoardID, Name: l.Name, Color: l.Color}
}

func toUser(u *user.User) userResponse {
	return userResponse{ID: u.ID, Name: u.Name, Email: u.Email}
}

func toBoardDetail(d *application.BoardDetail) boardDetailResponse {
	cols := make([]columnResponse, 0, len(d.Columns))
	for _, c := range d.Columns {
		cols = append(cols, toColumn(c))
	}
	cards := make([]cardResponse, 0, len(d.Cards))
	for _, c := range d.Cards {
		cards = append(cards, toCard(c))
	}
	labels := make([]labelResponse, 0, len(d.Labels))
	for _, l := range d.Labels {
		labels = append(labels, toLabel(l))
	}
	return boardDetailResponse{
		boardResponse: toBoard(d.Board),
		Columns:       cols,
		Cards:         cards,
		Labels:        labels,
	}
}
