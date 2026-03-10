CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL CHECK (role IN ('super_admin','admin','helpdesk','read_only')),
  password_hash TEXT        NOT NULL,
  active        BOOLEAN     NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default super admin  (password: changeme123 — CHANGE IMMEDIATELY IN PRODUCTION)
INSERT INTO users (email, name, role, password_hash)
VALUES ('admin@corp.local', 'System Admin', 'super_admin',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYCh/Xb3yCxC62W')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS policies (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL UNIQUE,
  description       TEXT,
  config            JSONB       NOT NULL DEFAULT '{}',
  amapi_policy_name TEXT        NOT NULL,
  version           INT         NOT NULL DEFAULT 1,
  status            TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version       INT  NOT NULL,
  config        JSONB NOT NULL,
  rollback_from INT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id, version)
);

CREATE TABLE IF NOT EXISTS groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  policy_id   UUID        REFERENCES policies(id) ON DELETE SET NULL,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  amapi_device_id      TEXT        NOT NULL UNIQUE,
  name                 TEXT        NOT NULL,
  model                TEXT,
  manufacturer         TEXT,
  serial               TEXT,
  imei                 TEXT,
  os_version           TEXT,
  security_patch_level TEXT,
  battery_level        NUMERIC(5,2),
  hardware_info        JSONB       DEFAULT '{}',
  group_id             UUID        REFERENCES groups(id) ON DELETE SET NULL,
  policy_id            UUID        REFERENCES policies(id) ON DELETE SET NULL,
  compliance_status    TEXT        NOT NULL DEFAULT 'unknown',
  status               TEXT        NOT NULL DEFAULT 'online',
  enrolled_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_group      ON devices(group_id);
CREATE INDEX IF NOT EXISTS idx_devices_compliance ON devices(compliance_status);
CREATE INDEX IF NOT EXISTS idx_devices_status     ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_name_trgm  ON devices USING gin(name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS enrollment_tokens (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  amapi_token_name TEXT        NOT NULL UNIQUE,
  token_value      TEXT        NOT NULL,
  group_id         UUID        REFERENCES groups(id) ON DELETE SET NULL,
  policy_id        UUID        REFERENCES policies(id) ON DELETE SET NULL,
  method           TEXT        NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS command_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        UUID        REFERENCES devices(id) ON DELETE SET NULL,
  type             TEXT        NOT NULL,
  amapi_command_id TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending',
  issued_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commands_device ON command_log(device_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor       TEXT,
  action      TEXT        NOT NULL,
  target      TEXT,
  ip_address  INET,
  meta        JSONB       DEFAULT '{}',
  result      TEXT        NOT NULL DEFAULT 'SUCCESS',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url              TEXT        NOT NULL,
  events           JSONB       NOT NULL DEFAULT '[]',
  secret           TEXT        NOT NULL,
  active           BOOLEAN     NOT NULL DEFAULT true,
  delivery_count   INT         NOT NULL DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
