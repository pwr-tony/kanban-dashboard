package mysql

import (
	"context"
	"database/sql"

	"kanban/internal/domain/board"
)

type MovementRepository struct {
	db *sql.DB
}

func NewMovementRepository(db *sql.DB) *MovementRepository {
	return &MovementRepository{db: db}
}

func (r *MovementRepository) Record(ctx context.Context, m *board.Movement) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO card_movements (card_id, from_column_id, to_column_id, moved_at) VALUES (?, ?, ?, ?)`,
		m.CardID, m.FromColumnID, m.ToColumnID, m.MovedAt)
	if err != nil {
		return err
	}
	m.ID, err = res.LastInsertId()
	return err
}

func (r *MovementRepository) ListByBoard(ctx context.Context, boardID int64) ([]*board.Movement, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT m.id, m.card_id, m.from_column_id, m.to_column_id, m.moved_at
		 FROM card_movements m
		 JOIN cards c ON c.id = m.card_id
		 WHERE c.board_id = ?
		 ORDER BY m.moved_at`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMovements(rows)
}

func (r *MovementRepository) ListByCard(ctx context.Context, cardID int64) ([]*board.Movement, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, card_id, from_column_id, to_column_id, moved_at
		 FROM card_movements WHERE card_id = ? ORDER BY moved_at`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMovements(rows)
}

func scanMovements(rows *sql.Rows) ([]*board.Movement, error) {
	var movements []*board.Movement
	for rows.Next() {
		m := &board.Movement{}
		var from sql.NullInt64
		if err := rows.Scan(&m.ID, &m.CardID, &from, &m.ToColumnID, &m.MovedAt); err != nil {
			return nil, err
		}
		if from.Valid {
			m.FromColumnID = &from.Int64
		}
		movements = append(movements, m)
	}
	return movements, rows.Err()
}
