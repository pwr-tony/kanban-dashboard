CREATE TABLE users (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE boards (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    created_at  DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE columns (
    id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    board_id  BIGINT UNSIGNED NOT NULL,
    name      VARCHAR(120) NOT NULL,
    position  INT NOT NULL DEFAULT 0,
    wip_limit INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_columns_board (board_id),
    CONSTRAINT fk_columns_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE labels (
    id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    board_id BIGINT UNSIGNED NOT NULL,
    name     VARCHAR(80) NOT NULL,
    color    VARCHAR(20) NOT NULL DEFAULT '#888888',
    PRIMARY KEY (id),
    KEY idx_labels_board (board_id),
    CONSTRAINT fk_labels_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cards (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    board_id    BIGINT UNSIGNED NOT NULL,
    column_id   BIGINT UNSIGNED NOT NULL,
    title       VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority    ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    assignee_id BIGINT UNSIGNED NULL,
    position    INT NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_cards_board (board_id),
    KEY idx_cards_column (column_id),
    CONSTRAINT fk_cards_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
    CONSTRAINT fk_cards_column FOREIGN KEY (column_id) REFERENCES columns (id) ON DELETE CASCADE,
    CONSTRAINT fk_cards_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE card_labels (
    card_id  BIGINT UNSIGNED NOT NULL,
    label_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (card_id, label_id),
    CONSTRAINT fk_cardlabels_card FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE,
    CONSTRAINT fk_cardlabels_label FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE card_movements (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    card_id        BIGINT UNSIGNED NOT NULL,
    from_column_id BIGINT UNSIGNED NULL,
    to_column_id   BIGINT UNSIGNED NOT NULL,
    moved_at       DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_movements_card (card_id),
    CONSTRAINT fk_movements_card FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
