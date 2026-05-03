-- Convert Prisma-created tables to hypertables (run after `npx prisma db push`).
-- Requires: extension.sql applied first.
SELECT public.create_hypertable('quotes', 'timestamp', if_not_exists => TRUE);
SELECT public.create_hypertable('news', 'timestamp', if_not_exists => TRUE);
SELECT public.create_hypertable('technical_indicators', 'timestamp', if_not_exists => TRUE);
