package board

import "strings"

type Priority string

const (
	PriorityLow    Priority = "low"
	PriorityMedium Priority = "medium"
	PriorityHigh   Priority = "high"
)

func ParsePriority(s string) (Priority, error) {
	switch Priority(strings.ToLower(strings.TrimSpace(s))) {
	case PriorityLow:
		return PriorityLow, nil
	case PriorityMedium, "":
		return PriorityMedium, nil
	case PriorityHigh:
		return PriorityHigh, nil
	default:
		return "", ErrInvalidPriority
	}
}

func (p Priority) String() string { return string(p) }
