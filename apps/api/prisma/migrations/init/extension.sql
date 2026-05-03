-- TimescaleDB extension (run against the same database as DATABASE_URL).
-- Example: psql "$DATABASE_URL" -f prisma/migrations/init/extension.sql
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
