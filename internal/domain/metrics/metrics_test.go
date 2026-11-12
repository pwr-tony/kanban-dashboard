package metrics

import (
	"testing"
	"time"

	"kanban/internal/domain/board"
)

func col(id int64, name string, pos, wip int) *board.Column {
	c, _ := board.NewColumn(1, name, pos, wip)
	c.ID = id
	return c
}

func TestCalculateColumnCountsAndOverLimit(t *testing.T) {
	columns := []*board.Column{
		col(1, "Backlog", 0, 0),
		col(2, "En progreso", 1, 2),
		col(3, "Hecho", 2, 0),
	}
	cards := []*board.Card{
		{ID: 1, ColumnID: 2},
		{ID: 2, ColumnID: 2},
		{ID: 3, ColumnID: 2},
		{ID: 4, ColumnID: 3},
	}

	m := Calculate(1, columns, cards, nil, 2, 3)

	if m.TotalCards != 4 {
		t.Fatalf("total esperado 4, obtuve %d", m.TotalCards)
	}
	var progreso ColumnMetric
	for _, c := range m.Columns {
		if c.ColumnID == 2 {
			progreso = c
		}
	}
	if progreso.CardCount != 3 || !progreso.OverLimit {
		t.Fatalf("columna 2 debió tener 3 tarjetas y estar sobre el límite, obtuve %+v", progreso)
	}
}

func TestCalculateCycleTime(t *testing.T) {
	start := int64(2)
	done := int64(3)
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	toStart := int64(2)
	movements := []*board.Movement{
		{CardID: 1, FromColumnID: &toStart, ToColumnID: 2, MovedAt: base},
		{CardID: 1, FromColumnID: &toStart, ToColumnID: 3, MovedAt: base.Add(10 * time.Hour)},
		{CardID: 2, FromColumnID: &toStart, ToColumnID: 2, MovedAt: base},
		{CardID: 2, FromColumnID: &toStart, ToColumnID: 3, MovedAt: base.Add(20 * time.Hour)},
	}

	m := Calculate(1, nil, nil, movements, start, done)

	if m.CycleTime.CompletedCards != 2 {
		t.Fatalf("esperaba 2 tarjetas completadas, obtuve %d", m.CycleTime.CompletedCards)
	}
	if m.CycleTime.AvgHours != 15 {
		t.Fatalf("promedio esperado 15h, obtuve %v", m.CycleTime.AvgHours)
	}
	if m.CycleTime.MinHours != 10 || m.CycleTime.MaxHours != 20 {
		t.Fatalf("min/max esperados 10/20, obtuve %v/%v", m.CycleTime.MinHours, m.CycleTime.MaxHours)
	}
}

func TestCycleTimeIgnoresUnfinishedCards(t *testing.T) {
	base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	movements := []*board.Movement{
		{CardID: 1, ToColumnID: 2, MovedAt: base},
	}

	m := Calculate(1, nil, nil, movements, 2, 3)

	if m.CycleTime.CompletedCards != 0 {
		t.Fatalf("no debió contar tarjetas sin terminar, obtuve %d", m.CycleTime.CompletedCards)
	}
}
