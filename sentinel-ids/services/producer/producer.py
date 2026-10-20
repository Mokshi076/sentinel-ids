"""Replays a CSV as a live stream. Reads in chunks, so memory stays flat for multi-GB files."""
import os, json, time, random, uuid, numpy as np, pandas as pd
from confluent_kafka import Producer

CSV, EPS = os.getenv("CSV_PATH", "../../data/sample.csv"), int(os.getenv("EPS", "500"))
p = Producer({"bootstrap.servers": os.getenv("KAFKA_BROKERS", "localhost:9092"),
              "linger.ms": 20, "batch.num.messages": 1000, "compression.type": "gzip"})
ip = lambda: ".".join(str(random.randint(1, 254)) for _ in range(4))

def run():
    sent, t0 = 0, time.time()
    for chunk in pd.read_csv(CSV, chunksize=5000, low_memory=False):
        chunk.columns = chunk.columns.str.strip()
        chunk = chunk.replace([np.inf, -np.inf], np.nan)
        chunk = chunk.astype(object).where(chunk.notna(), None)      # JSON-safe (no NaN)
        labels = chunk.pop("Label")
        for feats, lab in zip(chunk.to_dict("records"), labels):
            p.produce("raw-events", json.dumps({"id": str(uuid.uuid4()), "src_ip": ip(), "true_label": lab, "features": feats}))
            p.poll(0); sent += 1
            if sent % EPS == 0:                                      # simple rate limiter
                time.sleep(max(0, 1 - (time.time() - t0) % 1)); print("sent", sent, flush=True)
while True:
    run()
    if os.getenv("LOOP", "1") != "1": break
p.flush()
