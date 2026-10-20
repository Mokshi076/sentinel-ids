CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS events (
  ts timestamptz NOT NULL, src_ip text, label text,
  risk double precision, severity text, anomaly boolean);
SELECT create_hypertable('events','ts',if_not_exists=>TRUE);
CREATE INDEX IF NOT EXISTS events_sev_ts ON events (severity, ts DESC);
SELECT add_retention_policy('events', INTERVAL '7 days', if_not_exists=>TRUE);
