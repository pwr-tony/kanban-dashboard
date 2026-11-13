package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"kanban/internal/infrastructure/auth"
	"kanban/internal/interfaces/http/handlers"
)

func TestRouterBuildsAndHealthResponds(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := handlers.New(nil, nil, nil, nil)
	r := NewRouter(h, auth.NewJWTIssuer("test"), "*", "")

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("health esperaba 200, obtuvo %d", w.Code)
	}
}

func TestProtectedRouteRejectsWithoutToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := handlers.New(nil, nil, nil, nil)
	r := NewRouter(h, auth.NewJWTIssuer("test"), "*", "")

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/boards", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("esperaba 401 sin token, obtuvo %d", w.Code)
	}
}
