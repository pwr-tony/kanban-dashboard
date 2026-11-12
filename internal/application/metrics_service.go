package application

import (
	"context"
	"strings"

	"kanban/internal/domain/board"
	"kanban/internal/domain/metrics"
)

type MetricsService struct {
	boards    board.BoardRepository
	columns   board.ColumnRepository
	cards     board.CardRepository
	movements board.MovementRepository
}

func NewMetricsService(
	boards board.BoardRepository,
	columns board.ColumnRepository,
	cards board.CardRepository,
	movements board.MovementRepository,
) *MetricsService {
	return &MetricsService{boards: boards, columns: columns, cards: cards, movements: movements}
}

func (s *MetricsService) Get(ctx context.Context, boardID, startColumnID, doneColumnID int64) (metrics.BoardMetrics, error) {
	if _, err := s.boards.FindByID(ctx, boardID); err != nil {
		return metrics.BoardMetrics{}, err
	}
	cols, err := s.columns.ListByBoard(ctx, boardID)
	if err != nil {
		return metrics.BoardMetrics{}, err
	}
	cards, err := s.cards.ListByBoard(ctx, boardID)
	if err != nil {
		return metrics.BoardMetrics{}, err
	}
	movements, err := s.movements.ListByBoard(ctx, boardID)
	if err != nil {
		return metrics.BoardMetrics{}, err
	}

	start, done := resolveCycleColumns(cols, startColumnID, doneColumnID)
	return metrics.Calculate(boardID, cols, cards, movements, start, done), nil
}

func resolveCycleColumns(cols []*board.Column, start, done int64) (int64, int64) {
	if len(cols) == 0 {
		return start, done
	}
	ordered := make([]*board.Column, len(cols))
	copy(ordered, cols)
	for i := 0; i < len(ordered); i++ {
		for j := i + 1; j < len(ordered); j++ {
			if ordered[j].Position < ordered[i].Position {
				ordered[i], ordered[j] = ordered[j], ordered[i]
			}
		}
	}

	if start == 0 {
		for _, c := range ordered {
			name := strings.ToLower(c.Name)
			if strings.Contains(name, "progres") || strings.Contains(name, "doing") || strings.Contains(name, "curso") {
				start = c.ID
				break
			}
		}
		if start == 0 && len(ordered) > 1 {
			start = ordered[1].ID
		}
	}
	if done == 0 {
		done = ordered[len(ordered)-1].ID
	}
	return start, done
}
