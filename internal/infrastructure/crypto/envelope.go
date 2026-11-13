package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

const KeySize = 32

var (
	ErrUnknownKEK  = errors.New("crypto: KEK desconocida para esta DEK")
	ErrDecrypt     = errors.New("crypto: no se pudo descifrar (llave incorrecta o datos alterados)")
	ErrInvalidKey  = errors.New("crypto: la llave debe ser de 32 bytes en base64")
	ErrMissingKey  = errors.New("crypto: falta configurar la llave")
	ErrDuplicateID = errors.New("crypto: id de KEK repetido")
)

type Keyring struct {
	activeID string
	keks     map[string]cipher.AEAD
	indexKey []byte
}

type KeyringConfig struct {
	ActiveID      string
	ActiveKEK     string
	RetiredKEKs   string
	BlindIndexKey string
}

func NewKeyring(cfg KeyringConfig) (*Keyring, error) {
	if cfg.ActiveKEK == "" {
		return nil, fmt.Errorf("%w: USERVAR_KEK", ErrMissingKey)
	}
	if cfg.BlindIndexKey == "" {
		return nil, fmt.Errorf("%w: USERVAR_BLIND_INDEX_KEY", ErrMissingKey)
	}
	activeID := strings.TrimSpace(cfg.ActiveID)
	if activeID == "" {
		activeID = "v1"
	}

	k := &Keyring{activeID: activeID, keks: map[string]cipher.AEAD{}}

	active, err := decodeKey(cfg.ActiveKEK)
	if err != nil {
		return nil, fmt.Errorf("USERVAR_KEK: %w", err)
	}
	if k.keks[activeID], err = newGCM(active); err != nil {
		return nil, err
	}

	for _, entry := range strings.Split(cfg.RetiredKEKs, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		id, b64, ok := strings.Cut(entry, ":")
		id = strings.TrimSpace(id)
		if !ok || id == "" {
			return nil, fmt.Errorf("USERVAR_KEK_RETIRED: formato esperado id:base64, obtuvo %q", id)
		}
		if _, exists := k.keks[id]; exists {
			return nil, fmt.Errorf("%w: %s", ErrDuplicateID, id)
		}
		raw, err := decodeKey(b64)
		if err != nil {
			return nil, fmt.Errorf("USERVAR_KEK_RETIRED[%s]: %w", id, err)
		}
		if k.keks[id], err = newGCM(raw); err != nil {
			return nil, err
		}
	}

	if k.indexKey, err = decodeKey(cfg.BlindIndexKey); err != nil {
		return nil, fmt.Errorf("USERVAR_BLIND_INDEX_KEY: %w", err)
	}
	if hmac.Equal(k.indexKey, active) {
		return nil, errors.New("crypto: USERVAR_BLIND_INDEX_KEY no puede ser igual a la KEK")
	}
	return k, nil
}

func (k *Keyring) ActiveKEKID() string { return k.activeID }

func GenerateDEK() ([]byte, error) {
	dek := make([]byte, KeySize)
	if _, err := rand.Read(dek); err != nil {
		return nil, err
	}
	return dek, nil
}

func (k *Keyring) WrapDEK(dek []byte) ([]byte, string, error) {
	if len(dek) != KeySize {
		return nil, "", ErrInvalidKey
	}
	sealed, err := seal(k.keks[k.activeID], dek, dekAAD(k.activeID))
	return sealed, k.activeID, err
}

func (k *Keyring) UnwrapDEK(wrapped []byte, kekID string) ([]byte, error) {
	aead, ok := k.keks[kekID]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrUnknownKEK, kekID)
	}
	return open(aead, wrapped, dekAAD(kekID))
}

func (k *Keyring) BlindIndex(value string) []byte {
	mac := hmac.New(sha256.New, k.indexKey)
	mac.Write([]byte("kanban/blind-index/v1|"))
	mac.Write([]byte(value))
	return mac.Sum(nil)
}

func Seal(dek, plaintext []byte, aad string) ([]byte, error) {
	aead, err := newGCM(dek)
	if err != nil {
		return nil, err
	}
	return seal(aead, plaintext, []byte(aad))
}

func Open(dek, ciphertext []byte, aad string) ([]byte, error) {
	aead, err := newGCM(dek)
	if err != nil {
		return nil, err
	}
	return open(aead, ciphertext, []byte(aad))
}

func Wipe(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

func dekAAD(kekID string) []byte { return []byte("kanban/dek/v1|" + kekID) }

func newGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != KeySize {
		return nil, ErrInvalidKey
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func seal(aead cipher.AEAD, plaintext, aad []byte) ([]byte, error) {
	nonce := make([]byte, aead.NonceSize(), aead.NonceSize()+len(plaintext)+aead.Overhead())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, plaintext, aad), nil
}

func open(aead cipher.AEAD, data, aad []byte) ([]byte, error) {
	ns := aead.NonceSize()
	if len(data) < ns+aead.Overhead() {
		return nil, ErrDecrypt
	}
	out, err := aead.Open(nil, data[:ns], data[ns:], aad)
	if err != nil {
		return nil, ErrDecrypt
	}
	return out, nil
}

func decodeKey(b64 string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil || len(raw) != KeySize {
		return nil, ErrInvalidKey
	}
	return raw, nil
}
