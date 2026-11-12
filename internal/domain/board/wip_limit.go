package board

type WipLimit struct {
	value int
}

func NewWipLimit(v int) (WipLimit, error) {
	if v < 0 {
		return WipLimit{}, ErrNegativeWipLimit
	}
	return WipLimit{value: v}, nil
}

func Unlimited() WipLimit { return WipLimit{value: 0} }

func (w WipLimit) Value() int { return w.value }

func (w WipLimit) IsUnlimited() bool { return w.value == 0 }

func (w WipLimit) Allows(currentOccupancy int) bool {
	if w.IsUnlimited() {
		return true
	}
	return currentOccupancy < w.value
}
