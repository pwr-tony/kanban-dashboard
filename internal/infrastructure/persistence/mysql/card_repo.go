package mysql

import (
	"context"
	"database/sql"
	"errors"

	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
)

type CardRepository struct {
	db *sql.DB
}

func NewCardRepository(db *sql.DB) *CardRepository {
	return &CardRepository{db: db}
}

func (r *CardRepository) Create(ctx context.Context, c *board.Card) error {
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		c.BoardID, c.ColumnID, c.Title, c.Description, c.Priority.String(), c.AssigneeID, c.Position, c.CreatedAt)
	if err != nil {
		return err
	}
	c.ID, err = res.LastInsertId()
	return err
}

func (r *CardRepository) Update(ctx context.Context, c *board.Card) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cards SET title = ?, description = ?, priority = ?, assignee_id = ? WHERE id = ?`,
		c.Title, c.Description, c.Priority.String(), c.AssigneeID, c.ID)
	return err
}

func (r *CardRepository) Delete(ctx context.Context, id int64) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM cards WHERE id = ?`, id)
	return err
}

func (r *CardRepository) UpdateColumn(ctx context.Context, cardID, columnID int64) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cards SET column_id = ? WHERE id = ?`, columnID, cardID)
	return err
}

func (r *CardRepository) FindByID(ctx context.Context, id int64) (*board.Card, error) {
	c := &board.Card{}
	var priority string
	var assignee sql.NullInt64
	err := r.db.QueryRowContext(ctx,
		`SELECT id, board_id, column_id, title, description, priority, assignee_id, position, created_at
		 FROM cards WHERE id = ?`, id).
		Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description, &priority, &assignee, &c.Position, &c.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, board.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.Priority = board.Priority(priority)
	if assignee.Valid {
		c.AssigneeID = &assignee.Int64
	}
	c.LabelIDs, err = r.labelsFor(ctx, c.ID)
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CardRepository) ListByBoard(ctx context.Context, boardID int64) ([]*board.Card, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, board_id, column_id, title, description, priority, assignee_id, position, created_at
		 FROM cards WHERE board_id = ? ORDER BY column_id, position, id`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []*board.Card
	for rows.Next() {
		c := &board.Card{}
		var priority string
		var assignee sql.NullInt64
		if err := rows.Scan(&c.ID, &c.BoardID, &c.ColumnID, &c.Title, &c.Description,
			&priority, &assignee, &c.Position, &c.CreatedAt); err != nil {
			return nil, err
		}
		c.Priority = board.Priority(priority)
		if assignee.Valid {
			c.AssigneeID = &assignee.Int64
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, c := range cards {
		c.LabelIDs, err = r.labelsFor(ctx, c.ID)
		if err != nil {
			return nil, err
		}
	}
	return cards, nil
}

func (r *CardRepository) SetLabels(ctx context.Context, cardID int64, labelIDs []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM card_labels WHERE card_id = ?`, cardID); err != nil {
		return err
	}
	for _, labelID := range labelIDs {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)`, cardID, labelID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *CardRepository) labelsFor(ctx context.Context, cardID int64) ([]int64, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT label_id FROM card_labels WHERE card_id = ?`, cardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
