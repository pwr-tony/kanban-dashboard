package application

import (
	"context"
	"time"

	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
)

type CardService struct {
	cards     board.CardRepository
	columns   board.ColumnRepository
	movements board.MovementRepository
}

func NewCardService(
	cards board.CardRepository,
	columns board.ColumnRepository,
	movements board.MovementRepository,
) *CardService {
	return &CardService{cards: cards, columns: columns, movements: movements}
}

type CreateCardInput struct {
	BoardID     int64
	ColumnID    int64
	Title       string
	Description string
	Priority    string
	AssigneeID  *int64
	LabelIDs    []int64
}

func (s *CardService) Create(ctx context.Context, in CreateCardInput) (*board.Card, error) {
	col, err := s.columns.FindByID(ctx, in.ColumnID)
	if err != nil {
		return nil, err
	}
	priority, err := board.ParsePriority(in.Priority)
	if err != nil {
		return nil, err
	}
	c, err := board.NewCard(col.BoardID, col.ID, in.Title, in.Description, priority)
	if err != nil {
		return nil, err
	}
	c.AssigneeID = in.AssigneeID
	c.LabelIDs = in.LabelIDs
	if err := s.cards.Create(ctx, c); err != nil {
		return nil, err
	}
	if len(in.LabelIDs) > 0 {
		if err := s.cards.SetLabels(ctx, c.ID, in.LabelIDs); err != nil {
			return nil, err
		}
	}
	entry := board.Movement{CardID: c.ID, FromColumnID: nil, ToColumnID: col.ID, MovedAt: time.Now().UTC()}
	if err := s.movements.Record(ctx, &entry); err != nil {
		return nil, err
	}
	return c, nil
}

type UpdateCardInput struct {
	Title       string
	Description string
	Priority    string
	AssigneeID  *int64
	LabelIDs    []int64
}

func (s *CardService) Update(ctx context.Context, cardID int64, in UpdateCardInput) (*board.Card, error) {
	c, err := s.cards.FindByID(ctx, cardID)
	if err != nil {
		return nil, err
	}
	priority, err := board.ParsePriority(in.Priority)
	if err != nil {
		return nil, err
	}
	updated, err := board.NewCard(c.BoardID, c.ColumnID, in.Title, in.Description, priority)
	if err != nil {
		return nil, err
	}
	updated.ID = c.ID
	updated.Position = c.Position
	updated.CreatedAt = c.CreatedAt
	updated.AssigneeID = in.AssigneeID
	updated.LabelIDs = in.LabelIDs
	if err := s.cards.Update(ctx, updated); err != nil {
		return nil, err
	}
	if err := s.cards.SetLabels(ctx, updated.ID, in.LabelIDs); err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *CardService) Delete(ctx context.Context, cardID int64) error {
	return s.cards.Delete(ctx, cardID)
}

func (s *CardService) Move(ctx context.Context, cardID, targetColumnID int64) (*board.Card, error) {
	c, err := s.cards.FindByID(ctx, cardID)
	if err != nil {
		return nil, err
	}
	target, err := s.columns.FindByID(ctx, targetColumnID)
	if err != nil {
		return nil, err
	}
	occupancy, err := s.columns.CountCards(ctx, target.ID)
	if err != nil {
		return nil, err
	}

	movement, err := board.MoveCard(c, target, occupancy, time.Now())
	if err != nil {
		return nil, err
	}
	if movement.CardID == 0 {
		return c, nil
	}

	if err := s.cards.UpdateColumn(ctx, c.ID, target.ID); err != nil {
		return nil, err
	}
	if err := s.movements.Record(ctx, &movement); err != nil {
		return nil, err
	}
	return c, nil
}
