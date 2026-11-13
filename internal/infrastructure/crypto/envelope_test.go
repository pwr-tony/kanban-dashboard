package crypto

import (
	"bytes"
	"encoding/base64"
	"errors"
	"testing"
)

func key(b byte) string {
	return base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, KeySize))
}

func mustKeyring(t *testing.T, cfg KeyringConfig) *Keyring {
	t.Helper()
	k, err := NewKeyring(cfg)
	if err != nil {
		t.Fatalf("NewKeyring: %v", err)
	}
	return k
}

func TestEnvelopeRoundTrip(t *testing.T) {
	k := mustKeyring(t, KeyringConfig{ActiveKEK: key(1), BlindIndexKey: key(2)})

	dek, err := GenerateDEK()
	if err != nil {
		t.Fatal(err)
	}
	wrapped, kekID, err := k.WrapDEK(dek)
	if err != nil {
		t.Fatal(err)
	}
	if kekID != "v1" {
		t.Fatalf("id de KEK por defecto: esperaba v1, obtuvo %q", kekID)
	}
	if bytes.Contains(wrapped, dek) {
		t.Fatal("la DEK envuelta no debe contener la DEK en claro")
	}

	got, err := k.UnwrapDEK(wrapped, kekID)
	if err != nil || !bytes.Equal(got, dek) {
		t.Fatalf("UnwrapDEK no devolvió la DEK original: %v", err)
	}

	ct, err := Seal(dek, []byte("ana@kanban.mx"), "users.email")
	if err != nil {
		t.Fatal(err)
	}
	pt, err := Open(dek, ct, "users.email")
	if err != nil || string(pt) != "ana@kanban.mx" {
		t.Fatalf("Open: %q, %v", pt, err)
	}
}

func TestSealIsNonDeterministic(t *testing.T) {
	dek, _ := GenerateDEK()
	a, _ := Seal(dek, []byte("x"), "f")
	b, _ := Seal(dek, []byte("x"), "f")
	if bytes.Equal(a, b) {
		t.Fatal("dos cifrados del mismo valor no deben ser iguales (nonce aleatorio)")
	}
}

func TestOpenRejectsWrongFieldTamperingAndWrongKey(t *testing.T) {
	dek, _ := GenerateDEK()
	other, _ := GenerateDEK()
	ct, _ := Seal(dek, []byte("Ana"), "users.name")

	if _, err := Open(dek, ct, "users.email"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("aad distinto debe fallar, obtuvo %v", err)
	}
	if _, err := Open(other, ct, "users.name"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("otra DEK debe fallar, obtuvo %v", err)
	}
	tampered := append([]byte{}, ct...)
	tampered[len(tampered)-1] ^= 0x01
	if _, err := Open(dek, tampered, "users.name"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("datos alterados deben fallar, obtuvo %v", err)
	}
	if _, err := Open(dek, ct[:5], "users.name"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("datos truncados deben fallar, obtuvo %v", err)
	}
}

func TestRotationUnwrapsWithRetiredKEKAndRewrapsWithActive(t *testing.T) {
	old := mustKeyring(t, KeyringConfig{ActiveID: "v1", ActiveKEK: key(1), BlindIndexKey: key(9)})
	dek, _ := GenerateDEK()
	wrapped, id, _ := old.WrapDEK(dek)

	rotated := mustKeyring(t, KeyringConfig{
		ActiveID: "v2", ActiveKEK: key(3), RetiredKEKs: "v1:" + key(1), BlindIndexKey: key(9),
	})
	got, err := rotated.UnwrapDEK(wrapped, id)
	if err != nil || !bytes.Equal(got, dek) {
		t.Fatalf("la KEK retirada debe poder desenvolver: %v", err)
	}
	rewrapped, newID, err := rotated.WrapDEK(got)
	if err != nil || newID != "v2" {
		t.Fatalf("re-envolver debe usar la KEK activa: %q, %v", newID, err)
	}

	onlyNew := mustKeyring(t, KeyringConfig{ActiveID: "v2", ActiveKEK: key(3), BlindIndexKey: key(9)})
	if _, err := onlyNew.UnwrapDEK(wrapped, "v1"); !errors.Is(err, ErrUnknownKEK) {
		t.Fatalf("esperaba ErrUnknownKEK, obtuvo %v", err)
	}
	if _, err := onlyNew.UnwrapDEK(rewrapped, "v2"); err != nil {
		t.Fatalf("la DEK re-envuelta debe abrir con la KEK nueva: %v", err)
	}
}

func TestWrappedDEKIsBoundToItsKEKID(t *testing.T) {

	k := mustKeyring(t, KeyringConfig{ActiveID: "v1", ActiveKEK: key(1), RetiredKEKs: "v2:" + key(1), BlindIndexKey: key(2)})
	dek, _ := GenerateDEK()
	wrapped, _, _ := k.WrapDEK(dek)
	if _, err := k.UnwrapDEK(wrapped, "v2"); !errors.Is(err, ErrDecrypt) {
		t.Fatalf("esperaba ErrDecrypt, obtuvo %v", err)
	}
}

func TestBlindIndexIsDeterministicAndKeyed(t *testing.T) {
	a := mustKeyring(t, KeyringConfig{ActiveKEK: key(1), BlindIndexKey: key(2)})
	b := mustKeyring(t, KeyringConfig{ActiveKEK: key(1), BlindIndexKey: key(4)})

	if !bytes.Equal(a.BlindIndex("ana@kanban.mx"), a.BlindIndex("ana@kanban.mx")) {
		t.Fatal("el índice ciego debe ser determinista")
	}
	if bytes.Equal(a.BlindIndex("ana@kanban.mx"), a.BlindIndex("beto@kanban.mx")) {
		t.Fatal("valores distintos deben dar índices distintos")
	}
	if bytes.Equal(a.BlindIndex("ana@kanban.mx"), b.BlindIndex("ana@kanban.mx")) {
		t.Fatal("el índice depende de la llave")
	}
	if len(a.BlindIndex("x")) != 32 {
		t.Fatal("el índice debe medir 32 bytes")
	}
}

func TestNewKeyringValidation(t *testing.T) {
	short := base64.StdEncoding.EncodeToString([]byte("corta"))
	cases := map[string]KeyringConfig{
		"sin KEK":              {BlindIndexKey: key(2)},
		"sin llave de índice":  {ActiveKEK: key(1)},
		"KEK corta":            {ActiveKEK: short, BlindIndexKey: key(2)},
		"KEK no base64":        {ActiveKEK: "%%%", BlindIndexKey: key(2)},
		"índice igual a KEK":   {ActiveKEK: key(1), BlindIndexKey: key(1)},
		"retirada sin id":      {ActiveKEK: key(1), BlindIndexKey: key(2), RetiredKEKs: key(3)},
		"retirada id repetido": {ActiveKEK: key(1), BlindIndexKey: key(2), RetiredKEKs: "v1:" + key(3)},
	}
	for name, cfg := range cases {
		if _, err := NewKeyring(cfg); err == nil {
			t.Errorf("%s: esperaba error", name)
		}
	}
}
