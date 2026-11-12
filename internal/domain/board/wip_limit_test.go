package board

import "testing"

func TestNewWipLimitRejectsNegative(t *testing.T) {
	if _, err := NewWipLimit(-1); err != ErrNegativeWipLimit {
		t.Fatalf("esperaba ErrNegativeWipLimit, obtuve %v", err)
	}
}

func TestWipLimitAllows(t *testing.T) {
	cases := []struct {
		name      string
		limit     int
		occupancy int
		want      bool
	}{
		{"sin límite admite siempre", 0, 999, true},
		{"por debajo del límite admite", 3, 2, true},
		{"justo en el límite rechaza", 3, 3, false},
		{"por encima del límite rechaza", 3, 5, false},
		{"límite 1 vacío admite", 1, 0, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w, err := NewWipLimit(tc.limit)
			if err != nil {
				t.Fatalf("no esperaba error: %v", err)
			}
			if got := w.Allows(tc.occupancy); got != tc.want {
				t.Fatalf("Allows(%d) con límite %d = %v, quería %v", tc.occupancy, tc.limit, got, tc.want)
			}
		})
	}
}
