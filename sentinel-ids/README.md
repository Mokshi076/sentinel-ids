# SentinelML - Real-Time Cyber Threat & Intrusion Detection

Kafka stream → batched ML inference (XGBoost + Isolation Forest) → TimescaleDB / MongoDB → Socket.io → Next.js SOC dashboard, with Prometheus + Grafana.

## Quick start (works with no download: synthetic data included)
```bash
cd services/ml && pip install -r requirements.txt
python make_sample_data.py          # writes ../../data/sample.csv
python train.py                     # writes models/ids.joblib
cd ../..
docker compose up -d --build        # kafka, timescale, mongo, ml, gateway, dashboard, prometheus, grafana
docker compose --profile producer up -d producer   # start the live stream
```
Dashboard http://localhost:3000 · Grafana http://localhost:3002 (admin/admin) · Prometheus http://localhost:9090

**Real data:** download CICIDS2017 CSVs from Kaggle into a folder, then `python train.py /path/to/folder`, and point the producer at one CSV (`CSV_PATH`). The pipeline reads feature names from the trained model, so no code change is needed.

## Architecture
```
CSV ─► producer ─► Kafka [raw-events, 3 partitions]
                        │  consumer group "ids-gateway"
                        ▼
                  gateway (Node)  ──batch──► ML service (FastAPI) ── /predict
                    │   │   │
        TimescaleDB◄┘   │   └─► Socket.io (1 aggregated tick/sec) ─► Next.js dashboard
        MongoDB (raw, 24h TTL)◄─┘
        /metrics ◄── Prometheus ◄── ML /metrics ;  Grafana reads Prometheus
```

### Decoupling ingestion from inference
1. **Kafka is the buffer.** The producer never waits for ML. If inference slows down, messages queue in Kafka (consumer lag rises) instead of being dropped.
2. **Batching.** The gateway takes whatever a Kafka fetch returns (often hundreds of rows), splits it into chunks of 256, and sends one vectorised `/predict` call per chunk. One call for 256 rows is far cheaper than 256 calls.
3. **Independent scaling.** Add partitions + gateway replicas for ingestion; add ML replicas for inference. They scale separately.
4. **Fan-out is aggregated.** The browser receives one small summary per second, not every event.
5. **Failure isolation.** A failed ML call increments `prediction_errors_total`, drops only that chunk, and the consumer keeps going.

## ML pipeline (`services/ml`)
- **Preprocess:** strip column names, replace ±inf with NaN, drop duplicates, median-impute, StandardScaler, stratified 80/20 split. Imputer + scaler are saved inside the model file, so training and serving use identical transforms.
- **Supervised:** XGBoost multi-class with balanced sample weights (attacks are rare).
- **Unsupervised:** Isolation Forest trained on BENIGN only. If the classifier says BENIGN but the flow is an outlier (below the 1st-percentile score), it is reported as `ZERO_DAY_ANOMALY`.
- **Risk score** = 1 − P(benign). Severity: high > 0.9, medium > 0.7, else low.
- Note: the bundled synthetic data is easy, so its scores will look near perfect. Use real CICIDS2017 for honest numbers, and judge by per-class recall / F1, not accuracy.

## Databases
- **TimescaleDB (`db/init.sql`):** `events` hypertable (ts, ip, label, risk, severity), `time_bucket` queries for charts, 7-day retention policy.
- **MongoDB:** raw event payloads (schema-free, wide feature sets), 24h TTL index to cap storage.

## Observability
| Metric | Source | Why |
|---|---|---|
| `ingest_events_total` | gateway | throughput |
| `threats_total{label,severity}` | gateway | threat spikes |
| `inference_roundtrip_seconds`, `ml_inference_seconds` | gateway / ML | latency (p95) |
| `prediction_errors_total`, `ml_prediction_errors_total` | both | error rate |
| `kafka_batch_size` | gateway | large batches ≈ the consumer is falling behind |
| default Node metrics | gateway | memory, event-loop |

Grafana dashboard "IDS System Health & Threat Spikes" is auto-provisioned (8 panels). Prometheus alert rules in `monitoring/alerts.yml`: `ThreatSpike`, `InferenceSlow`, `PredictionErrors`.

## Bottlenecks & fixes
| Bottleneck | Fix |
|---|---|
| Inference latency | Batch requests, vectorised predict, keep model in memory, scale ML replicas, optionally export to ONNX |
| Large CSV memory | Producer reads 5,000-row chunks; training can downcast to float32 or sample BENIGN |
| Consumer lag | More partitions + gateway replicas (same group id); watch `kafka_batch_size` |
| DB write load | Bulk `unnest` inserts, one per batch; Timescale compression for old chunks |
| Browser flooding | 1s aggregation, feed capped at 20 rows |
| Raw storage growth | Mongo TTL + Timescale retention |
| Poison messages | Invalid JSON is skipped; add a dead-letter topic for production |
| Model drift | Track `ml_predictions_total` label mix and retrain on schedule |

## Production hardening (not included)
Auth on the gateway + Socket.io, TLS, Kafka replication ≥ 3, secrets management, restricted CORS, model versioning (MLflow), and a dead-letter topic.

## Layout
```
docker-compose.yml  db/init.sql  data/
services/{ml,producer,gateway}   dashboard/ (Next.js 14, Tailwind, Recharts)
monitoring/{prometheus.yml,alerts.yml,grafana/}
```
