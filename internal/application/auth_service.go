package application

import (
	"context"

	"kanban/internal/domain/user"
)

type AuthService struct {
	users  user.Repository
	hasher PasswordHasher
	tokens TokenIssuer

	decoyHash string
}

func NewAuthService(users user.Repository, hasher PasswordHasher, tokens TokenIssuer) *AuthService {
	s := &AuthService{users: users, hasher: hasher, tokens: tokens}

	s.decoyHash, _ = hasher.Hash("kanban-decoy-password")
	return s
}

type AuthResult struct {
	User  *user.User
	Token string
}

func (s *AuthService) Register(ctx context.Context, name, email, password string) (*AuthResult, error) {
	email = user.NormalizeEmail(email)
	if existing, _ := s.users.FindByEmail(ctx, email); existing != nil {
		return nil, user.ErrEmailTaken
	}
	hash, err := s.hasher.Hash(password)
	if err != nil {
		return nil, err
	}
	u, err := user.NewUser(name, email, hash)
	if err != nil {
		return nil, err
	}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	token, err := s.tokens.Issue(u.ID)
	if err != nil {
		return nil, err
	}
	return &AuthResult{User: u, Token: token}, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	u, err := s.users.FindByEmail(ctx, user.NormalizeEmail(email))
	if err != nil {
		_ = s.hasher.Compare(s.decoyHash, password)
		return nil, user.ErrInvalidCreds
	}
	if err := s.hasher.Compare(u.PasswordHash, password); err != nil {
		return nil, user.ErrInvalidCreds
	}
	token, err := s.tokens.Issue(u.ID)
	if err != nil {
		return nil, err
	}
	return &AuthResult{User: u, Token: token}, nil
}

func (s *AuthService) ListUsers(ctx context.Context) ([]*user.User, error) {
	return s.users.List(ctx)
}
