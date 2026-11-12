package mysql

import (
	"context"
	"database/sql"

	"kanban/internal/domain/board"
)

type LabelRepository struct {
	db *sql.DB
}

func NewLabelRepository(db *sql.DB) *LabelRepository {
	return &LabelRepository{db: db}
}

func (r *LabelRepository) Create(ctx context.Context, l *board.Label) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO labels (board_id, name, color) VALUES (?, ?, ?)`,
		l.BoardID, l.Name, l.Color)
	if err != nil {
		return err
	}
	l.ID, err = res.LastInsertId()
	return err
}

func (r *LabelRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM labels WHERE id = ?`, id)
	return err
}

func (r *LabelRepository) ListByBoard(ctx context.Context, boardID int64) ([]*board.Label, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, board_id, name, color FROM labels WHERE board_id = ? ORDER BY name`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var labels []*board.Label
	for rows.Next() {
		l := &board.Label{}
		if err := rows.Scan(&l.ID, &l.BoardID, &l.Name, &l.Color); err != nil {
			return nil, err
		}
		labels = append(labels, l)
	}
	return labels, rows.Err()
}
