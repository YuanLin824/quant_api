#!/bin/bash
set -e

echo "========== Postgres 初始化 =========="

echo "========== 创建用户和数据库 =========="
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
-- 创建用户
CREATE USER ${PG_USER} WITH LOGIN CREATEDB PASSWORD '${PG_PASS}';
-- 创建数据库
CREATE DATABASE ${PG_DB} OWNER ${PG_USER};
-- 把新建的库授权给新创建的用户
GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};
EOSQL

echo "========== 创建 TimescaleDB 扩展 =========="
# 必须以超级用户身份在 quant_db 上执行(quant 非超级用户无法建扩展)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$PG_DB" <<-EOSQL
CREATE EXTENSION IF NOT EXISTS timescaledb;
GRANT USAGE ON SCHEMA public TO ${PG_USER};
GRANT CREATE ON SCHEMA public TO ${PG_USER};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${PG_USER};
EOSQL

# echo "========== 创建表结构 =========="
# psql -v ON_ERROR_STOP=1 --username "$PG_USER" --dbname "$PG_DB" <<-EOSQL
# -- ====== 关系表 ======
# CREATE TABLE IF NOT EXISTS symbols (
#   symbol     TEXT PRIMARY KEY,
#   market     TEXT NOT NULL,
#   base       TEXT,
#   quote      TEXT,
#   name       TEXT,
#   metadata   JSONB,
#   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
# );

# CREATE TABLE IF NOT EXISTS strategies (
#   id          BIGSERIAL PRIMARY KEY,
#   name        TEXT NOT NULL UNIQUE,
#   description TEXT,
#   config      JSONB NOT NULL,
#   created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
# );

# CREATE TABLE IF NOT EXISTS orders (
#   id           BIGSERIAL PRIMARY KEY,
#   strategy_id  BIGINT REFERENCES strategies(id),
#   symbol       TEXT NOT NULL,
#   side         TEXT NOT NULL,
#   qty          NUMERIC NOT NULL,
#   type         TEXT NOT NULL,
#   price        NUMERIC,
#   status       TEXT NOT NULL,
#   idem_key     TEXT UNIQUE,
#   created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
# );

# CREATE TABLE IF NOT EXISTS backtest_runs (
#   id              BIGSERIAL PRIMARY KEY,
#   strategy_id     BIGINT REFERENCES strategies(id),
#   symbol          TEXT NOT NULL,
#   timeframe       TEXT NOT NULL,
#   start_date      TIMESTAMPTZ NOT NULL,
#   end_date        TIMESTAMPTZ NOT NULL,
#   initial_capital NUMERIC NOT NULL,
#   config          JSONB NOT NULL,
#   result          JSONB,
#   status          TEXT NOT NULL DEFAULT 'pending',
#   created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
#   completed_at    TIMESTAMPTZ
# );

# -- ====== 时序表(TimescaleDB hypertable) ======
# CREATE TABLE IF NOT EXISTS klines (
#   symbol     TEXT        NOT NULL,
#   ts         TIMESTAMPTZ NOT NULL,
#   timeframe  TEXT        NOT NULL,
#   open       NUMERIC     NOT NULL,
#   high       NUMERIC     NOT NULL,
#   low        NUMERIC     NOT NULL,
#   close      NUMERIC     NOT NULL,
#   volume     NUMERIC     NOT NULL,
#   amount     NUMERIC,
#   PRIMARY KEY (symbol, timeframe, ts)
# );

# SELECT create_hypertable(
#   'klines', 'ts',
#   chunk_time_interval => INTERVAL '7 days',
#   if_not_exists => TRUE
# );

# -- ====== 索引 ======
# CREATE INDEX IF NOT EXISTS idx_klines_symbol_tf_ts ON klines (symbol, timeframe, ts DESC);
# CREATE INDEX IF NOT EXISTS idx_symbols_market ON symbols (market);
# CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders (strategy_id);
# CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders (symbol);
# CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy ON backtest_runs (strategy_id);
# CREATE INDEX IF NOT EXISTS idx_backtest_runs_status ON backtest_runs (status);
# EOSQL

echo "========== Postgres 初始化完成 =========="
