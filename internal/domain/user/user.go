package user

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrEmptyName    = errors.New("el nombre no puede estar vacío")
	ErrInvalidEmail = errors.New("email inválido")
	ErrNotFound     = errors.New("usuario no encontrado")
	ErrEmailTaken   = errors.New("el email ya está registrado")
	ErrInvalidCreds = errors.New("credenciales inválidas")
)

type User struct {
	ID           int64
	Name         string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

func NewUser(name, email, passwordHash string) (*User, error) {
	name = strings.TrimSpace(name)
	email = NormalizeEmail(email)
	if name == "" {
		return nil, ErrEmptyName
	}
	if !strings.Contains(email, "@") || len(email) < 3 {
		return nil, ErrInvalidEmail
	}
	return &User{
		Name:         name,
		Email:        email,
		PasswordHash: passwordHash,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

type Repository interface {
	Create(ctx context.Context, u *User) error
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id int64) (*User, error)
	List(ctx context.Context) ([]*User, error)
}
