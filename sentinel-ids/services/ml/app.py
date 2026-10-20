import os, joblib, numpy as np, pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, make_asgi_app

M = joblib.load(os.getenv("MODEL_PATH", "models/ids.joblib"))   # loaded once at startup
BENIGN = int(M["le"].transform(["BENIGN"])[0])
app = FastAPI(title="IDS inference")
app.mount("/metrics", make_asgi_app())
LAT = Histogram("ml_inference_seconds", "Batch inference latency", buckets=(.005,.01,.025,.05,.1,.25,.5,1))
PRED = Counter("ml_predictions_total", "Predictions", ["label"])
ERR = Counter("ml_prediction_errors_total", "Inference errors")

class Batch(BaseModel):
    events: list[dict]

@app.get("/health")
def health(): return {"ok": True, "features": len(M["features"])}

@app.post("/predict")
def predict(b: Batch):
    try:
        with LAT.time():
            X = pd.DataFrame(b.events).reindex(columns=M["features"]).astype("float32").replace([np.inf, -np.inf], np.nan)
            Xs = M["prep"].transform(X)
            proba = M["clf"].predict_proba(Xs); idx = proba.argmax(1)
            iso = M["iso"].score_samples(Xs)
        out = []
        for i in range(len(X)):
            label = str(M["le"].classes_[idx[i]]); anomaly = bool(iso[i] < M["iso_thr"])
            risk = float(1 - proba[i, BENIGN])
            if label == "BENIGN" and anomaly: label, risk = "ZERO_DAY_ANOMALY", max(risk, 0.7)
            sev = "none" if label == "BENIGN" else ("high" if risk > 0.9 else "medium" if risk > 0.7 else "low")
            PRED.labels(label).inc()
            out.append(dict(label=label, risk=round(risk, 4), severity=sev, anomaly=anomaly))
        return {"results": out}
    except Exception:
        ERR.inc(); raise
