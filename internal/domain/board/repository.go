package board

import (
	"context"
	"errors"
)

var ErrNotFound = errors.New("recurso no encontrado")

type BoardRepository interface {
	Create(ctx context.Context, b *Board) error
	Update(ctx context.Context, b *Board) error
	Delete(ctx context.Context, id int64) error
	FindByID(ctx context.Context, id int64) (*Board, error)
	List(ctx context.Context) ([]*Board, error)
}

type ColumnRepository interface {
	Create(ctx context.Context, c *Column) error
	Update(ctx context.Context, c *Column) error
	FindByID(ctx context.Context, id int64) (*Column, error)
	ListByBoard(ctx context.Context, boardID int64) ([]*Column, error)
	CountCards(ctx context.Context, columnID int64) (int, error)
}

type CardRepository interface {
	Create(ctx context.Context, c *Card) error
	Update(ctx context.Context, c *Card) error
	Delete(ctx context.Context, id int64) error
	FindByID(ctx context.Context, id int64) (*Card, error)
	ListByBoard(ctx context.Context, boardID int64) ([]*Card, error)
	UpdateColumn(ctx context.Context, cardID, columnID int64) error
	SetLabels(ctx context.Context, cardID int64, labelIDs []int64) error
}

type LabelRepository interface {
	Create(ctx context.Context, l *Label) error
	Delete(ctx context.Context, id int64) error
	ListByBoard(ctx context.Context, boardID int64) ([]*Label, error)
}

type MovementRepository interface {
	Record(ctx context.Context, m *Movement) error
	ListByBoard(ctx context.Context, boardID int64) ([]*Movement, error)
	ListByCard(ctx context.Context, cardID int64) ([]*Movement, error)
}
