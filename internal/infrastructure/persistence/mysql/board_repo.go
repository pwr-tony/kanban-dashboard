package mysql

import (
	"context"
	"database/sql"
	"errors"

	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
)

type BoardRepository struct {
	db *sql.DB
}

func NewBoardRepository(db *sql.DB) *BoardRepository {
	return &BoardRepository{db: db}
}

func (r *BoardRepository) Create(ctx context.Context, b *board.Board) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO boards (name, description, created_at) VALUES (?, ?, ?)`,
		b.Name, b.Description, b.CreatedAt)
	if err != nil {
		return err
	}
	b.ID, err = res.LastInsertId()
	return err
}

func (r *BoardRepository) Update(ctx context.Context, b *board.Board) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE boards SET name = ?, description = ? WHERE id = ?`,
		b.Name, b.Description, b.ID)
	return err
}

func (r *BoardRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM boards WHERE id = ?`, id)
	return err
}

func (r *BoardRepository) FindByID(ctx context.Context, id int64) (*board.Board, error) {
	b := &board.Board{}
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, description, created_at FROM boards WHERE id = ?`, id).
		Scan(&b.ID, &b.Name, &b.Description, &b.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, board.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *BoardRepository) List(ctx context.Context) ([]*board.Board, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, description, created_at FROM boards ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boards []*board.Board
	for rows.Next() {
		b := &board.Board{}
		if err := rows.Scan(&b.ID, &b.Name, &b.Description, &b.CreatedAt); err != nil {
			return nil, err
		}
		boards = append(boards, b)
	}
	return boards, rows.Err()
}
