package board

import (
	"testing"
	"time"
)

func newTestColumn(id, boardID int64, wip int) *Column {
	c, err := NewColumn(boardID, "Col", 0, wip)
	if err != nil {
		panic(err)
	}
	c.ID = id
	return c
}

func TestMoveCardBlockedWhenTargetAtWipLimit(t *testing.T) {
	card := &Card{ID: 1, BoardID: 10, ColumnID: 100}
	target := newTestColumn(200, 10, 2)

	_, err := MoveCard(card, target, 2, time.Now())

	if err != ErrWipLimitReached {
		t.Fatalf("esperaba ErrWipLimitReached, obtuve %v", err)
	}
	if card.ColumnID != 100 {
		t.Fatalf("la tarjeta no debió moverse, quedó en columna %d", card.ColumnID)
	}
}

func TestMoveCardSucceedsBelowLimit(t *testing.T) {
	card := &Card{ID: 1, BoardID: 10, ColumnID: 100}
	target := newTestColumn(200, 10, 3)
	now := time.Now()

	mv, err := MoveCard(card, target, 2, now)

	if err != nil {
		t.Fatalf("no esperaba error: %v", err)
	}
	if card.ColumnID != 200 {
		t.Fatalf("la tarjeta debió quedar en columna 200, quedó en %d", card.ColumnID)
	}
	if mv.ToColumnID != 200 || mv.FromColumnID == nil || *mv.FromColumnID != 100 {
		t.Fatalf("movimiento mal registrado: %+v", mv)
	}
}

func TestMoveCardUnlimitedColumnAlwaysAccepts(t *testing.T) {
	card := &Card{ID: 1, BoardID: 10, ColumnID: 100}
	target := newTestColumn(200, 10, 0)

	if _, err := MoveCard(card, target, 1000, time.Now()); err != nil {
		t.Fatalf("columna sin límite debió aceptar, obtuve %v", err)
	}
}

func TestMoveCardRejectsColumnFromAnotherBoard(t *testing.T) {
	card := &Card{ID: 1, BoardID: 10, ColumnID: 100}
	target := newTestColumn(200, 99, 5)

	if _, err := MoveCard(card, target, 0, time.Now()); err != ErrColumnBoardMismatch {
		t.Fatalf("esperaba ErrColumnBoardMismatch, obtuve %v", err)
	}
}

func TestMoveCardToSameColumnIsNoop(t *testing.T) {
	card := &Card{ID: 1, BoardID: 10, ColumnID: 200}
	target := newTestColumn(200, 10, 1)

	mv, err := MoveCard(card, target, 1, time.Now())
	if err != nil {
		t.Fatalf("mover a la misma columna no debió fallar: %v", err)
	}
	if mv.CardID != 0 {
		t.Fatalf("no debió generarse movimiento, obtuve %+v", mv)
	}
}
