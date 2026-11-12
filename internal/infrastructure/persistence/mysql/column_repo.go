package mysql

import (
	"context"
	"database/sql"
	"errors"

	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
)

type ColumnRepository struct {
	db *sql.DB
}

func NewColumnRepository(db *sql.DB) *ColumnRepository {
	return &ColumnRepository{db: db}
}

func (r *ColumnRepository) Create(ctx context.Context, c *board.Column) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO columns (board_id, name, position, wip_limit) VALUES (?, ?, ?, ?)`,
		c.BoardID, c.Name, c.Position, c.WipLimit.Value())
	if err != nil {
		return err
	}
	c.ID, err = res.LastInsertId()
	return err
}

func (r *ColumnRepository) Update(ctx context.Context, c *board.Column) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE columns SET name = ?, position = ?, wip_limit = ? WHERE id = ?`,
		c.Name, c.Position, c.WipLimit.Value(), c.ID)
	return err
}

func (r *ColumnRepository) FindByID(ctx context.Context, id int64) (*board.Column, error) {
	var (
		boardID  int64
		name     string
		position int
		wip      int
	)
	err := r.db.QueryRowContext(ctx,
		`SELECT board_id, name, position, wip_limit FROM columns WHERE id = ?`, id).
		Scan(&boardID, &name, &position, &wip)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, board.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c, err := board.NewColumn(boardID, name, position, wip)
	if err != nil {
		return nil, err
	}
	c.ID = id
	return c, nil
}

func (r *ColumnRepository) ListByBoard(ctx context.Context, boardID int64) ([]*board.Column, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, board_id, name, position, wip_limit FROM columns WHERE board_id = ? ORDER BY position`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []*board.Column
	for rows.Next() {
		var (
			id, bID  int64
			name     string
			position int
			wip      int
		)
		if err := rows.Scan(&id, &bID, &name, &position, &wip); err != nil {
			return nil, err
		}
		c, err := board.NewColumn(bID, name, position, wip)
		if err != nil {
			return nil, err
		}
		c.ID = id
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

func (r *ColumnRepository) CountCards(ctx context.Context, columnID int64) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM cards WHERE column_id = ?`, columnID).Scan(&n)
	return n, err
}
