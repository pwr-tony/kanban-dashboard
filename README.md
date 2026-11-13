# Dashboard Kanban

Aplicación para **gestionar el ciclo de vida de un proyecto con Kanban**: tableros, columnas con límite de **WIP**, tarjetas que fluyen por el proceso y un **dashboard de métricas** (WIP por columna y *cycle time*). Es el proyecto integrador del curso de métodos ágiles: se construye aplicando Kanban, XP (TDD) y Scrum, y la propia app sirve para gestionar su desarrollo.

La pieza central es la **regla de WIP**: la aplicación **impide mover** una tarjeta a una columna que ya alcanzó su límite de trabajo en curso. *La app aplica lo que enseña Kanban.*

---

## Stack

| Capa | Tecnología |
|------|------------|
| Backend / API | **Go** + **Gin** (API REST) |
| Base de datos | **MySQL 8** |
| Migraciones | **golang-migrate** (SQL versionado) |
| Frontend | **HTML + CSS + JS** (vanilla), servido por el mismo binario de Go |
| Auth | **JWT** (HS256) + **bcrypt** |
| Datos personales | **Cifrado por sobre** (KEK/DEK, AES-256-GCM) + índice ciego HMAC-SHA256 |
| Contenedores | **Docker** multi-stage + **docker-compose** |
| Arquitectura | **DDD** (Domain-Driven Design), 4 capas |

---

## Arquitectura DDD

El código se organiza **alrededor del dominio** (las reglas del Kanban), no alrededor del framework ni de la base de datos. El núcleo no depende de detalles técnicos; estos se "enchufan" por fuera.

```
            ┌─────────────────────────────────────────────┐
            │                 Interfaces                    │  Gin: handlers, router, DTOs, middleware JWT
            │        (internal/interfaces/http)             │
            └───────────────────┬─────────────────────────┘
                                │ depende de
            ┌───────────────────▼─────────────────────────┐
            │                Application                     │  Casos de uso: CrearTablero, MoverTarjeta, GetMetrics
            │          (internal/application)               │
            └───────────────────┬─────────────────────────┘
                                │ depende de
            ┌───────────────────▼─────────────────────────┐
            │                  Domain                        │  Entidades, Value Objects, reglas (WIP), interfaces de repo
            │           (internal/domain)                    │  ← NO importa nada de las otras capas
            └───────────────────▲─────────────────────────┘
                                │ implementa las interfaces del dominio
            ┌───────────────────┴─────────────────────────┐
            │               Infrastructure                   │  Repos MySQL, config, bcrypt, JWT
            │          (internal/infrastructure)            │
            └─────────────────────────────────────────────┘
```

**Regla de oro (dependencias hacia adentro):** `Interfaces → Application → Domain`, e `Infrastructure` también apunta al `Domain` (implementa sus interfaces de repositorio). El **Domain no importa nada** de las otras capas: por eso se puede cambiar MySQL por otra BD, o Gin por gRPC, sin tocar las reglas del Kanban.

### Dónde vive cada cosa

- **Domain** (`internal/domain/`)
  - `board/` — entidades `Board`, `Column`, `Card`, `Label`, `Movement`; value objects `WipLimit` y `Priority`; el servicio de dominio `MoveCard` (la regla de WIP); las interfaces de repositorio.
  - `user/` — entidad `User` y su repositorio.
  - `metrics/` — cálculo **puro** de métricas (conteos, over-limit, cycle time) sin tocar BD.
- **Application** (`internal/application/`) — orquesta el dominio: `BoardService`, `CardService`, `MetricsService`, `AuthService`. No contiene reglas de negocio propias; define los *puertos* `PasswordHasher` y `TokenIssuer`.
- **Infrastructure** (`internal/infrastructure/`) — el "cómo": repositorios MySQL (`persistence/mysql`), `config`, `auth` (bcrypt + JWT).
- **Interfaces** (`internal/interfaces/http/`) — Gin: `handlers`, `router.go`, `middleware` (JWT), DTOs y mapeo de errores de dominio a códigos HTTP.

---

## Estructura del proyecto

```
kanban-dashboard/
├── cmd/api/main.go                 # arranque: carga .env, inyecta dependencias, levanta el router
├── internal/
│   ├── domain/
│   │   ├── board/                  # NÚCLEO: entidades, value objects, regla de WIP, interfaces de repo
│   │   ├── user/
│   │   └── metrics/                # cálculo puro de métricas
│   ├── application/                # casos de uso
│   ├── infrastructure/
│   │   ├── persistence/mysql/      # repositorios con MySQL
│   │   ├── config/                 # carga de configuración (vars USERVAR_*)
│   │   ├── auth/                   # bcrypt + JWT
│   │   └── crypto/                 # cifrado por sobre KEK/DEK + índice ciego
│   └── interfaces/http/            # Gin: handlers, router, middleware, DTOs
├── migrations/                     # 000001_init, 000002_user_envelope_encryption
├── scripts/seed.sql                # datos de ejemplo (tablero demo con cycle time)
├── frontend/                       # HTML + CSS + JS en módulos ES (servido por el propio binario)
│   └── js/                         # main, app, board, metrics, dialogs, auth, ui, api, store, lib
├── deploy/nginx.conf               # nginx: estáticos + proxy a la API (docker-compose)
├── Dockerfile                      # imagen multi-stage del backend (incluye el frontend)
├── docker-compose.yml              # db + migrate + api + frontend
├── .env.example                    # plantilla de configuración
└── .env                            # configuración local (no se versiona)
```

---

## Cómo correr

### Opción A — Docker (todo de cero, lo que pide la rúbrica)

Requiere Docker. Copia la plantilla y genera las llaves (la API no arranca sin ellas):

```bash
cp .env.example .env
# en .env: USERVAR_JWT_SECRET, USERVAR_KEK y USERVAR_BLIND_INDEX_KEY
openssl rand -base64 32   # una vez para la KEK y otra para el índice ciego
docker-compose up --build
```

Levanta **MySQL 8**, corre las **migraciones** (servicio `migrate`), arranca la **API** y sirve el **frontend**. Queda todo corriendo sin instalar nada en la máquina.

- API: http://localhost:8080
- Frontend (nginx): http://localhost:3000 — sirve los estáticos y reenvía el resto a la API (mismo origen)

### Opción B — Local con `go run` (desarrollo)

Necesitas Go 1.26+ y un MySQL accesible. Con un `.env` válido (ver abajo), la app **carga sola** la configuración (godotenv) y **sirve también el frontend** desde el mismo binario:

```bash
go run ./cmd/api
```

Abre **http://localhost:8080** — ahí sale el login y el tablero. Un solo comando, un solo puerto, cero servicios extra.

---

## Variables de entorno

La app lee variables con prefijo `USERVAR_` (autocargadas desde `.env`):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `USERVAR_HTTP_PORT` | `8080` | Puerto de la API |
| `USERVAR_DB_HOST` | `localhost` | Host de MySQL |
| `USERVAR_DB_PORT` | `3306` | Puerto de MySQL |
| `USERVAR_DB_USER` | `kanban` | Usuario de BD (solo necesita DML) |
| `USERVAR_DB_PASSWORD` | `kanban` | Contraseña |
| `USERVAR_DB_NAME` | `kanban` | Nombre de la base |
| `USERVAR_JWT_SECRET` | *(dev)* | Llave para firmar los tokens JWT |
| `USERVAR_CORS_ORIGIN` | `*` | Origen permitido para CORS |
| `USERVAR_STATIC_DIR` | `frontend` | Carpeta estática que sirve el binario (vacío = no servir) |
| `USERVAR_KEK` | — **requerida** | KEK activa: 32 bytes en base64 (`openssl rand -base64 32`) |
| `USERVAR_KEK_ID` | `v1` | Id de la KEK activa; se guarda junto a cada DEK |
| `USERVAR_KEK_RETIRED` | *(vacío)* | Solo al rotar: KEKs anteriores `id:base64,id:base64` |
| `USERVAR_BLIND_INDEX_KEY` | — **requerida** | Llave HMAC del índice ciego del email (distinta de la KEK) |

> El usuario de la app solo requiere **DML** (`SELECT/INSERT/UPDATE/DELETE`). El DDL (crear tablas) lo hacen las **migraciones**, que se corren con un usuario privilegiado una sola vez — mínimo privilegio.

---

## Cifrado de datos personales (KEK/DEK)

El nombre y el email de cada usuario se guardan **cifrados en reposo** con *envelope encryption* (`internal/infrastructure/crypto`):

- **DEK** (*data encryption key*): llave AES-256 aleatoria, **una por usuario**. Cifra `name` y `email` con AES-256-GCM; cada campo lleva su nombre como AAD, así que no se puede copiar el email cifrado al campo del nombre.
- **KEK** (*key encryption key*): vive **fuera de la BD** (`USERVAR_KEK`). Solo envuelve las DEKs; la tabla guarda `dek_wrapped` y `kek_id`.
- **Índice ciego**: `email_index = HMAC-SHA256(email normalizado)` con otra llave. Permite el login y la unicidad del email sin guardarlo en claro.
- El **JWT solo lleva el id** del usuario (`sub`): su payload es legible, así que no lleva datos personales.

**Migración de datos existentes.** La migración `000002` agrega las columnas cifradas. Al arrancar, la API cifra las filas que siguen en claro (incluido el usuario del seed) y deja `name`/`email` en `NULL`. Es idempotente.

**Rotar la KEK.** Pon la nueva en `USERVAR_KEK` con un `USERVAR_KEK_ID` nuevo y la anterior en `USERVAR_KEK_RETIRED=v1:<base64>`. Al arrancar, la API re-envuelve todas las DEKs (los datos no se re-cifran). En el siguiente despliegue ya puedes quitar la KEK retirada.

> ⚠️ Si se pierde la KEK, los nombres y emails cifrados son **irrecuperables**. No rotes `USERVAR_BLIND_INDEX_KEY` a la ligera: cambiarla rompe la búsqueda por email. Revertir la `000002` destruye los datos ya cifrados.

---

## Base de datos y migraciones

El esquema se crea **siempre con migraciones versionadas** (`migrations/`), nunca a mano, para que cualquiera levante el proyecto desde cero.

Tablas: `users`, `boards`, `columns`, `labels`, `cards`, `card_labels`, `card_movements`.

- `card_movements` registra cada paso de una tarjeta entre columnas (con `moved_at`): es la **bitácora** que permite calcular el *cycle time* de forma fiable.

### Seed de ejemplo

`scripts/seed.sql` crea un tablero **"Proyecto Demo"** con las 5 columnas del flujo real (Backlog → Por hacer → En progreso → En pruebas → Hecho), tarjetas distribuidas, etiquetas, un usuario asignado y movimientos **fechados** para que el dashboard muestre cycle times reales.

```bash
set -a && . ./.env && set +a
MYSQL_PWD="$USERVAR_DB_PASSWORD" mysql -h "$USERVAR_DB_HOST" -P "$USERVAR_DB_PORT" \
  -u "$USERVAR_DB_USER" "$USERVAR_DB_NAME" < scripts/seed.sql
```

Usuario demo: **`demo@kanban.mx` / `demo1234`**.

---

## API REST

Autenticación: todas las rutas bajo protección requieren el header `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/register` | Crear cuenta → devuelve JWT |
| `POST` | `/auth/login` | Iniciar sesión → devuelve JWT |
| `GET` | `/users` | Listar usuarios (para asignación) |
| `GET` | `/boards` | Listar tableros |
| `POST` | `/boards` | Crear tablero |
| `GET` | `/boards/{id}` | Tablero con columnas, tarjetas y etiquetas |
| `PUT` | `/boards/{id}` | Editar tablero |
| `DELETE` | `/boards/{id}` | Eliminar tablero |
| `GET` | `/boards/{id}/metrics` | Métricas (WIP, cycle time, conteos) |
| `POST` | `/boards/{id}/columns` | Crear columna (con `wip_limit`) |
| `PUT` | `/columns/{id}` | Editar columna / límite WIP |
| `POST` | `/boards/{id}/labels` | Crear etiqueta |
| `DELETE` | `/labels/{id}` | Eliminar etiqueta |
| `POST` | `/columns/{id}/cards` | Crear tarjeta |
| `PUT` | `/cards/{id}` | Editar tarjeta |
| `POST` | `/cards/{id}/move` | **Mover** a otra columna → **409** si excede el WIP |
| `DELETE` | `/cards/{id}` | Eliminar tarjeta |

### La regla de WIP

`POST /cards/{id}/move` llama al servicio de dominio `board.MoveCard`, que verifica la ocupación de la columna destino contra su `WipLimit`. Si está llena, devuelve el error de dominio `ErrWipLimitReached`, que la capa HTTP traduce a:

```json
HTTP 409 Conflict
{ "error": "la columna destino alcanzó su límite de WIP", "code": "wip_limit_reached" }
```

### Cycle time

`MetricsService` reconstruye, a partir de `card_movements`, el tiempo entre que una tarjeta **entró a "En progreso"** y **entró a "Hecho"**. Por defecto detecta esas columnas por convención (la que contiene "progreso" y la última por posición); se pueden fijar con `?start_column_id=X&done_column_id=Y`.

---

## Pruebas (TDD — Unidad 3)

El dominio se construyó con pruebas primero. Cubren la regla de WIP, los value objects y el cálculo de métricas:

```bash
go test ./...
```

- `internal/domain/board/` — `WipLimit.Allows`, `MoveCard` (bloqueo por WIP, cruce de tableros, no-op a misma columna).
- `internal/domain/metrics/` — conteos, over-limit, cycle time (ignora tarjetas sin terminar).
- `internal/infrastructure/crypto/` — ida y vuelta KEK/DEK, rechazo de datos alterados, AAD por campo, rotación de KEK e índice ciego.
- `internal/interfaces/http/` — el router construye sin conflictos y protege las rutas.

---

## Mapeo a las unidades del curso

| Unidad | Evidencia en el proyecto |
|--------|--------------------------|
| **U2 (Kanban/MoSCoW)** | Priorización MoSCoW del MVP; el equipo gestiona el desarrollo en un tablero Kanban |
| **U3 (XP)** | **TDD** del dominio (`go test`) + pair programming |
| **U4 (Scrum)** | Backlog de historias + sprint documentado |
| **U5** | **MVP dockerizado** + este documento de **arquitectura (DDD)** + demo |

---

## Alcance

MVP pequeño pero bien hecho: tableros, columnas con WIP, tarjetas que se mueven respetando el límite, dashboard de métricas, y como extras incluidos: autenticación, asignación de tarjetas, etiquetas/colores e historial de movimientos. Lo importante es **aplicar bien el proceso ágil, la arquitectura DDD y dockerizar**.
