package metrics

import (
	"sort"
	"time"

	"github.com/pwr-tony/kanban-dashboard/internal/domain/board"
)

type ColumnMetric struct {
	ColumnID  int64  `json:"column_id"`
	Name      string `json:"name"`
	WipLimit  int    `json:"wip_limit"`
	CardCount int    `json:"card_count"`
	OverLimit bool   `json:"over_limit"`
}

type CardCycleTime struct {
	CardID int64   `json:"card_id"`
	Hours  float64 `json:"hours"`
}

type CycleTimeMetric struct {
	CompletedCards int             `json:"completed_cards"`
	AvgHours       float64         `json:"avg_hours"`
	MinHours       float64         `json:"min_hours"`
	MaxHours       float64         `json:"max_hours"`
	PerCard        []CardCycleTime `json:"per_card"`
}

type BoardMetrics struct {
	BoardID    int64           `json:"board_id"`
	TotalCards int             `json:"total_cards"`
	Columns    []ColumnMetric  `json:"columns"`
	CycleTime  CycleTimeMetric `json:"cycle_time"`
}

func Calculate(
	boardID int64,
	columns []*board.Column,
	cards []*board.Card,
	movements []*board.Movement,
	startColumnID, doneColumnID int64,
) BoardMetrics {
	counts := make(map[int64]int)
	for _, c := range cards {
		counts[c.ColumnID]++
	}

	sort.Slice(columns, func(i, j int) bool {
		return columns[i].Position < columns[j].Position
	})

	cols := make([]ColumnMetric, 0, len(columns))
	for _, col := range columns {
		n := counts[col.ID]
		cols = append(cols, ColumnMetric{
			ColumnID:  col.ID,
			Name:      col.Name,
			WipLimit:  col.WipLimit.Value(),
			CardCount: n,
			OverLimit: !col.WipLimit.IsUnlimited() && n > col.WipLimit.Value(),
		})
	}

	cycle := calculateCycleTime(movements, startColumnID, doneColumnID)

	return BoardMetrics{
		BoardID:    boardID,
		TotalCards: len(cards),
		Columns:    cols,
		CycleTime:  cycle,
	}
}

func calculateCycleTime(movements []*board.Movement, startColumnID, doneColumnID int64) CycleTimeMetric {
	result := CycleTimeMetric{PerCard: []CardCycleTime{}}
	if startColumnID == 0 || doneColumnID == 0 {
		return result
	}

	byCard := make(map[int64][]*board.Movement)
	for _, m := range movements {
		byCard[m.CardID] = append(byCard[m.CardID], m)
	}

	var sum float64
	for cardID, ms := range byCard {
		sort.Slice(ms, func(i, j int) bool {
			return ms[i].MovedAt.Before(ms[j].MovedAt)
		})

		var startedAt, doneAt time.Time
		for _, m := range ms {
			if m.ToColumnID == startColumnID && startedAt.IsZero() {
				startedAt = m.MovedAt
			}
			if m.ToColumnID == doneColumnID {
				doneAt = m.MovedAt
			}
		}

		if startedAt.IsZero() || doneAt.IsZero() || doneAt.Before(startedAt) {
			continue
		}

		hours := doneAt.Sub(startedAt).Hours()
		result.PerCard = append(result.PerCard, CardCycleTime{CardID: cardID, Hours: round2(hours)})
		sum += hours
	}

	n := len(result.PerCard)
	result.CompletedCards = n
	if n == 0 {
		return result
	}

	sort.Slice(result.PerCard, func(i, j int) bool {
		return result.PerCard[i].CardID < result.PerCard[j].CardID
	})

	result.MinHours = result.PerCard[0].Hours
	result.MaxHours = result.PerCard[0].Hours
	for _, c := range result.PerCard {
		if c.Hours < result.MinHours {
			result.MinHours = c.Hours
		}
		if c.Hours > result.MaxHours {
			result.MaxHours = c.Hours
		}
	}
	result.AvgHours = round2(sum / float64(n))
	return result
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}
