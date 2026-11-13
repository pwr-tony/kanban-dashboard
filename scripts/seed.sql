START TRANSACTION;

DELETE FROM boards WHERE name = 'Proyecto Demo';
-- Tras el primer arranque la API cifra el email del demo (queda NULL en claro),
-- así que también se identifica por su hash bcrypt, que es único por la sal.
-- La API lo vuelve a cifrar al arrancar (UserRepository.EncryptLegacyRows).
DELETE FROM users
WHERE email = 'demo@kanban.mx'
   OR password_hash = '$2a$10$flDvcpm5.AzEbEEfkwE4C.lmmKxt7gMlU2X4bHDBQ0ENCDfd3vJwe';

INSERT INTO users (name, email, password_hash, created_at)
VALUES ('Demo Dev', 'demo@kanban.mx', '$2a$10$flDvcpm5.AzEbEEfkwE4C.lmmKxt7gMlU2X4bHDBQ0ENCDfd3vJwe', NOW());
SET @u = LAST_INSERT_ID();

INSERT INTO boards (name, description, created_at)
VALUES ('Proyecto Demo', 'Tablero de ejemplo con flujo completo y cycle time', NOW() - INTERVAL 10 DAY);
SET @b = LAST_INSERT_ID();

INSERT INTO columns (board_id, name, position, wip_limit) VALUES (@b, 'Backlog', 0, 0);
SET @c1 = LAST_INSERT_ID();
INSERT INTO columns (board_id, name, position, wip_limit) VALUES (@b, 'Por hacer', 1, 0);
SET @c2 = LAST_INSERT_ID();
INSERT INTO columns (board_id, name, position, wip_limit) VALUES (@b, 'En progreso', 2, 3);
SET @c3 = LAST_INSERT_ID();
INSERT INTO columns (board_id, name, position, wip_limit) VALUES (@b, 'En pruebas', 3, 2);
SET @c4 = LAST_INSERT_ID();
INSERT INTO columns (board_id, name, position, wip_limit) VALUES (@b, 'Hecho', 4, 0);
SET @c5 = LAST_INSERT_ID();

INSERT INTO labels (board_id, name, color) VALUES (@b, 'Bug', '#e74c3c');
SET @l1 = LAST_INSERT_ID();
INSERT INTO labels (board_id, name, color) VALUES (@b, 'Feature', '#3498db');
SET @l2 = LAST_INSERT_ID();
INSERT INTO labels (board_id, name, color) VALUES (@b, 'Infra', '#9b59b6');
SET @l3 = LAST_INSERT_ID();

INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c5, 'Setup repositorio DDD', 'Estructura de capas, go.mod y migraciones', 'high', @u, 0, NOW() - INTERVAL 8 DAY);
SET @k1 = LAST_INSERT_ID();
INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c5, 'Endpoint mover tarjeta (WIP)', 'POST /cards/:id/move con validacion 409', 'high', @u, 1, NOW() - INTERVAL 7 DAY);
SET @k2 = LAST_INSERT_ID();
INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c5, 'Migraciones MySQL', 'Esquema versionado con golang-migrate', 'medium', NULL, 2, NOW() - INTERVAL 9 DAY);
SET @k3 = LAST_INSERT_ID();

INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c3, 'Dashboard de metricas', 'WIP por columna y cycle time', 'high', @u, 0, NOW() - INTERVAL 4 DAY);
SET @k4 = LAST_INSERT_ID();
INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c3, 'Frontend drag and drop', 'Mover tarjetas con HTML5 DnD', 'medium', NULL, 1, NOW() - INTERVAL 3 DAY);
SET @k5 = LAST_INSERT_ID();

INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c4, 'Autenticacion JWT', 'Registro, login y middleware', 'medium', @u, 0, NOW() - INTERVAL 5 DAY);
SET @k6 = LAST_INSERT_ID();

INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c2, 'Etiquetas y colores', 'Labels por tablero y asignacion a tarjetas', 'low', NULL, 0, NOW() - INTERVAL 2 DAY);
SET @k7 = LAST_INSERT_ID();

INSERT INTO cards (board_id, column_id, title, description, priority, assignee_id, position, created_at)
VALUES (@b, @c1, 'Grafica de flujo acumulado (CFD)', 'Opcional, conecta con Unidad 5', 'low', NULL, 0, NOW() - INTERVAL 1 DAY);
SET @k8 = LAST_INSERT_ID();

INSERT INTO card_movements (card_id, from_column_id, to_column_id, moved_at) VALUES
  (@k1, NULL, @c2, NOW() - INTERVAL 8 DAY),
  (@k1, @c2, @c3, NOW() - INTERVAL 7 DAY),
  (@k1, @c3, @c4, NOW() - INTERVAL 6 DAY),
  (@k1, @c4, @c5, NOW() - INTERVAL 5 DAY),
  (@k2, NULL, @c2, NOW() - INTERVAL 7 DAY),
  (@k2, @c2, @c3, NOW() - INTERVAL 6 DAY),
  (@k2, @c3, @c5, NOW() - INTERVAL 5 DAY),
  (@k3, NULL, @c1, NOW() - INTERVAL 9 DAY),
  (@k3, @c1, @c3, NOW() - INTERVAL 6 DAY),
  (@k3, @c3, @c4, NOW() - INTERVAL 4 DAY),
  (@k3, @c4, @c5, NOW() - INTERVAL 3 DAY),
  (@k4, NULL, @c2, NOW() - INTERVAL 4 DAY),
  (@k4, @c2, @c3, NOW() - INTERVAL 2 DAY),
  (@k5, NULL, @c2, NOW() - INTERVAL 3 DAY),
  (@k5, @c2, @c3, NOW() - INTERVAL 1 DAY),
  (@k6, NULL, @c2, NOW() - INTERVAL 5 DAY),
  (@k6, @c2, @c3, NOW() - INTERVAL 3 DAY),
  (@k6, @c3, @c4, NOW() - INTERVAL 2 DAY),
  (@k7, NULL, @c2, NOW() - INTERVAL 2 DAY),
  (@k8, NULL, @c1, NOW() - INTERVAL 1 DAY);

INSERT INTO card_labels (card_id, label_id) VALUES
  (@k1, @l3),
  (@k2, @l2),
  (@k6, @l2),
  (@k7, @l2),
  (@k3, @l3);

COMMIT;

SELECT CONCAT('Tablero "Proyecto Demo" creado con id=', @b, ', usuario demo id=', @u) AS resultado;
