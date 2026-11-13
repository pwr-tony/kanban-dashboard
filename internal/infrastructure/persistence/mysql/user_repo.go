package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"

	driver "github.com/go-sql-driver/mysql"
	"kanban/internal/domain/user"
	"kanban/internal/infrastructure/crypto"
)

const (
	aadName  = "users.name"
	aadEmail = "users.email"

	userColumns = `id, name_enc, email_enc, dek_wrapped, kek_id, password_hash, created_at`
)

type UserRepository struct {
	db   *sql.DB
	keys *crypto.Keyring
}

func NewUserRepository(db *sql.DB, keys *crypto.Keyring) *UserRepository {
	return &UserRepository{db: db, keys: keys}
}

type encryptedUser struct {
	nameEnc, emailEnc, emailIndex, dekWrapped []byte
	kekID                                     string
}

func (r *UserRepository) encrypt(name, email string) (*encryptedUser, error) {
	dek, err := crypto.GenerateDEK()
	if err != nil {
		return nil, err
	}
	defer crypto.Wipe(dek)

	out := &encryptedUser{emailIndex: r.keys.BlindIndex(user.NormalizeEmail(email))}
	if out.nameEnc, err = crypto.Seal(dek, []byte(name), aadName); err != nil {
		return nil, err
	}
	if out.emailEnc, err = crypto.Seal(dek, []byte(email), aadEmail); err != nil {
		return nil, err
	}
	if out.dekWrapped, out.kekID, err = r.keys.WrapDEK(dek); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *UserRepository) Create(ctx context.Context, u *user.User) error {
	enc, err := r.encrypt(u.Name, u.Email)
	if err != nil {
		return err
	}
	res, err := r.db.ExecContext(ctx,
		`INSERT INTO users (name, email, email_index, name_enc, email_enc, dek_wrapped, kek_id, password_hash, created_at)
		 VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
		enc.emailIndex, enc.nameEnc, enc.emailEnc, enc.dekWrapped, enc.kekID, u.PasswordHash, u.CreatedAt)
	if isDuplicateKey(err) {
		return user.ErrEmailTaken
	}
	if err != nil {
		return err
	}
	u.ID, err = res.LastInsertId()
	return err
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	idx := r.keys.BlindIndex(user.NormalizeEmail(email))
	return r.findOne(ctx, `SELECT `+userColumns+` FROM users WHERE email_index = ?`, idx)
}

func (r *UserRepository) FindByID(ctx context.Context, id int64) (*user.User, error) {
	return r.findOne(ctx, `SELECT `+userColumns+` FROM users WHERE id = ? AND dek_wrapped IS NOT NULL`, id)
}

func (r *UserRepository) findOne(ctx context.Context, query string, arg any) (*user.User, error) {
	u, err := r.scanDecrypt(r.db.QueryRowContext(ctx, query, arg))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, user.ErrNotFound
	}
	return u, err
}

func (r *UserRepository) List(ctx context.Context) ([]*user.User, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+userColumns+` FROM users WHERE dek_wrapped IS NOT NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*user.User
	for rows.Next() {
		u, err := r.scanDecrypt(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(users, func(i, j int) bool {
		return strings.ToLower(users[i].Name) < strings.ToLower(users[j].Name)
	})
	return users, nil
}

type scanner interface{ Scan(dest ...any) error }

func (r *UserRepository) scanDecrypt(s scanner) (*user.User, error) {
	var (
		u                          user.User
		nameEnc, emailEnc, wrapped []byte
		kekID                      sql.NullString
	)
	if err := s.Scan(&u.ID, &nameEnc, &emailEnc, &wrapped, &kekID, &u.PasswordHash, &u.CreatedAt); err != nil {
		return nil, err
	}
	dek, err := r.keys.UnwrapDEK(wrapped, kekID.String)
	if err != nil {
		return nil, fmt.Errorf("usuario %d: %w", u.ID, err)
	}
	defer crypto.Wipe(dek)

	name, err := crypto.Open(dek, nameEnc, aadName)
	if err != nil {
		return nil, fmt.Errorf("usuario %d (nombre): %w", u.ID, err)
	}
	email, err := crypto.Open(dek, emailEnc, aadEmail)
	if err != nil {
		return nil, fmt.Errorf("usuario %d (email): %w", u.ID, err)
	}
	u.Name, u.Email = string(name), string(email)
	return &u, nil
}

func (r *UserRepository) EncryptLegacyRows(ctx context.Context) (int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, email FROM users WHERE dek_wrapped IS NULL AND email IS NOT NULL`)
	if err != nil {
		return 0, err
	}
	type legacy struct {
		id          int64
		name, email string
	}
	var pending []legacy
	for rows.Next() {
		var l legacy
		var name sql.NullString
		if err := rows.Scan(&l.id, &name, &l.email); err != nil {
			rows.Close()
			return 0, err
		}
		l.name = name.String
		pending = append(pending, l)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	done := 0
	for _, l := range pending {
		email := user.NormalizeEmail(l.email)
		enc, err := r.encrypt(l.name, email)
		if err != nil {
			return done, err
		}
		res, err := r.db.ExecContext(ctx,
			`UPDATE users SET name = NULL, email = NULL, email_index = ?, name_enc = ?, email_enc = ?, dek_wrapped = ?, kek_id = ?
			 WHERE id = ? AND dek_wrapped IS NULL`,
			enc.emailIndex, enc.nameEnc, enc.emailEnc, enc.dekWrapped, enc.kekID, l.id)
		if isDuplicateKey(err) {
			return done, fmt.Errorf("usuario %d: su email ya existe cifrado en otra fila; elimina el duplicado: %w", l.id, user.ErrEmailTaken)
		}
		if err != nil {
			return done, err
		}
		if n, _ := res.RowsAffected(); n == 1 {
			done++
		}
	}
	return done, nil
}

func (r *UserRepository) RewrapRetiredKEKs(ctx context.Context) (int, error) {
	active := r.keys.ActiveKEKID()
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, dek_wrapped, kek_id FROM users WHERE dek_wrapped IS NOT NULL AND kek_id <> ?`, active)
	if err != nil {
		return 0, err
	}
	type stale struct {
		id      int64
		wrapped []byte
		kekID   string
	}
	var pending []stale
	for rows.Next() {
		var s stale
		if err := rows.Scan(&s.id, &s.wrapped, &s.kekID); err != nil {
			rows.Close()
			return 0, err
		}
		pending = append(pending, s)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	done := 0
	for _, s := range pending {
		dek, err := r.keys.UnwrapDEK(s.wrapped, s.kekID)
		if err != nil {
			return done, fmt.Errorf("usuario %d: %w", s.id, err)
		}
		wrapped, kekID, err := r.keys.WrapDEK(dek)
		crypto.Wipe(dek)
		if err != nil {
			return done, err
		}
		res, err := r.db.ExecContext(ctx,
			`UPDATE users SET dek_wrapped = ?, kek_id = ? WHERE id = ? AND kek_id = ?`,
			wrapped, kekID, s.id, s.kekID)
		if err != nil {
			return done, err
		}
		if n, _ := res.RowsAffected(); n == 1 {
			done++
		}
	}
	return done, nil
}

func isDuplicateKey(err error) bool {
	var me *driver.MySQLError
	return errors.As(err, &me) && me.Number == 1062
}
