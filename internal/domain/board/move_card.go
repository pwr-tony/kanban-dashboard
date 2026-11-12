package board

import "time"

func MoveCard(card *Card, target *Column, targetOccupancy int, now time.Time) (Movement, error) {
	if target.BoardID != card.BoardID {
		return Movement{}, ErrColumnBoardMismatch
	}

	if card.ColumnID == target.ID {
		return Movement{}, nil
	}

	if !target.WipLimit.Allows(targetOccupancy) {
		return Movement{}, ErrWipLimitReached
	}

	from := card.ColumnID
	movement := Movement{
		CardID:       card.ID,
		FromColumnID: &from,
		ToColumnID:   target.ID,
		MovedAt:      now.UTC(),
	}
	card.ColumnID = target.ID
	return movement, nil
}
