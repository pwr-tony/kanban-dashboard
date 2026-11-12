package board

import (
	"strings"
	"time"
)

type Board struct {
	ID          int64
	Name        string
	Description string
	CreatedAt   time.Time
}

func NewBoard(name, description string) (*Board, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrEmptyBoardName
	}
	return &Board{
		Name:        name,
		Description: strings.TrimSpace(description),
		CreatedAt:   time.Now().UTC(),
	}, nil
}

func (b *Board) Rename(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrEmptyBoardName
	}
	b.Name = name
	return nil
}

type Column struct {
	ID       int64
	BoardID  int64
	Name     string
	Position int
	WipLimit WipLimit
}

func NewColumn(boardID int64, name string, position, wipLimit int) (*Column, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrEmptyColumnName
	}
	if position < 0 {
		return nil, ErrInvalidPosition
	}
	limit, err := NewWipLimit(wipLimit)
	if err != nil {
		return nil, err
	}
	return &Column{
		BoardID:  boardID,
		Name:     name,
		Position: position,
		WipLimit: limit,
	}, nil
}

type Label struct {
	ID      int64
	BoardID int64
	Name    string
	Color   string
}

type Card struct {
	ID          int64
	BoardID     int64
	ColumnID    int64
	Title       string
	Description string
	Priority    Priority
	AssigneeID  *int64
	Position    int
	LabelIDs    []int64
	CreatedAt   time.Time
}

func NewCard(boardID, columnID int64, title, description string, priority Priority) (*Card, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, ErrEmptyCardTitle
	}
	if priority == "" {
		priority = PriorityMedium
	}
	return &Card{
		BoardID:     boardID,
		ColumnID:    columnID,
		Title:       title,
		Description: strings.TrimSpace(description),
		Priority:    priority,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

type Movement struct {
	ID           int64
	CardID       int64
	FromColumnID *int64
	ToColumnID   int64
	MovedAt      time.Time
}
