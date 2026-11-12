package board

import "errors"

var (
	ErrEmptyBoardName      = errors.New("el nombre del tablero no puede estar vacío")
	ErrEmptyColumnName     = errors.New("el nombre de la columna no puede estar vacío")
	ErrEmptyCardTitle      = errors.New("el título de la tarjeta no puede estar vacío")
	ErrNegativeWipLimit    = errors.New("el límite de WIP no puede ser negativo")
	ErrInvalidPriority     = errors.New("prioridad inválida (usa: low, medium, high)")
	ErrInvalidPosition     = errors.New("la posición no puede ser negativa")
	ErrWipLimitReached     = errors.New("la columna destino alcanzó su límite de WIP")
	ErrColumnBoardMismatch = errors.New("la columna destino pertenece a otro tablero")
)
