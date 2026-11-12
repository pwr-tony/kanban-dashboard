package application

import (
	"context"

	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
)

type BoardService struct {
	boards  board.BoardRepository
	columns board.ColumnRepository
	cards   board.CardRepository
	labels  board.LabelRepository
}

func NewBoardService(
	boards board.BoardRepository,
	columns board.ColumnRepository,
	cards board.CardRepository,
	labels board.LabelRepository,
) *BoardService {
	return &BoardService{boards: boards, columns: columns, cards: cards, labels: labels}
}

type BoardDetail struct {
	Board   *board.Board
	Columns []*board.Column
	Cards   []*board.Card
	Labels  []*board.Label
}

func (s *BoardService) Create(ctx context.Context, name, description string) (*board.Board, error) {
	b, err := board.NewBoard(name, description)
	if err != nil {
		return nil, err
	}
	if err := s.boards.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *BoardService) List(ctx context.Context) ([]*board.Board, error) {
	return s.boards.List(ctx)
}

func (s *BoardService) Get(ctx context.Context, id int64) (*BoardDetail, error) {
	b, err := s.boards.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	cols, err := s.columns.ListByBoard(ctx, id)
	if err != nil {
		return nil, err
	}
	cards, err := s.cards.ListByBoard(ctx, id)
	if err != nil {
		return nil, err
	}
	labels, err := s.labels.ListByBoard(ctx, id)
	if err != nil {
		return nil, err
	}
	return &BoardDetail{Board: b, Columns: cols, Cards: cards, Labels: labels}, nil
}

func (s *BoardService) Update(ctx context.Context, id int64, name, description string) (*board.Board, error) {
	b, err := s.boards.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := b.Rename(name); err != nil {
		return nil, err
	}
	b.Description = description
	if err := s.boards.Update(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *BoardService) Delete(ctx context.Context, id int64) error {
	return s.boards.Delete(ctx, id)
}

func (s *BoardService) CreateColumn(ctx context.Context, boardID int64, name string, position, wipLimit int) (*board.Column, error) {
	if _, err := s.boards.FindByID(ctx, boardID); err != nil {
		return nil, err
	}
	c, err := board.NewColumn(boardID, name, position, wipLimit)
	if err != nil {
		return nil, err
	}
	if err := s.columns.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *BoardService) UpdateColumn(ctx context.Context, columnID int64, name string, position, wipLimit int) (*board.Column, error) {
	c, err := s.columns.FindByID(ctx, columnID)
	if err != nil {
		return nil, err
	}
	updated, err := board.NewColumn(c.BoardID, name, position, wipLimit)
	if err != nil {
		return nil, err
	}
	updated.ID = c.ID
	if err := s.columns.Update(ctx, updated); err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *BoardService) CreateLabel(ctx context.Context, boardID int64, name, color string) (*board.Label, error) {
	l := &board.Label{BoardID: boardID, Name: name, Color: color}
	if err := s.labels.Create(ctx, l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *BoardService) DeleteLabel(ctx context.Context, id int64) error {
	return s.labels.Delete(ctx, id)
}

func (s *BoardService) ListLabels(ctx context.Context, boardID int64) ([]*board.Label, error) {
	return s.labels.ListByBoard(ctx, boardID)
}
