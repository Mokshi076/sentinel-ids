import os, io, json, joblib, numpy as np, pandas as pd
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, make_asgi_app

MP = os.getenv("MODEL_PATH", "models/ids.joblib")
M = joblib.load(MP)                                   # loaded once at startup
BENIGN = int(M["le"].transform(["BENIGN"])[0])
app = FastAPI(title="IDS inference")
app.mount("/metrics", make_asgi_app())
LAT = Histogram("ml_inference_seconds", "Batch inference latency", buckets=(.005,.01,.025,.05,.1,.25,.5,1))
PRED = Counter("ml_predictions_total", "Predictions", ["label"])
ERR = Counter("ml_prediction_errors_total", "Inference errors")

class Batch(BaseModel):
    events: list[dict]

def score(df: pd.DataFrame):
    with LAT.time():
        X = df.reindex(columns=M["features"]).astype("float32").replace([np.inf, -np.inf], np.nan)
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
    return out

@app.get("/health")
def health(): return {"ok": True, "features": len(M["features"])}

@app.post("/predict")
def predict(b: Batch):
    try: return {"results": score(pd.DataFrame(b.events))}
    except Exception:
        ERR.inc(); raise

@app.get("/report")
def report():
    p = os.path.join(os.path.dirname(MP), "report.json")
    if not os.path.exists(p): raise HTTPException(404, "report.json not found - run train.py first")
    return json.load(open(p))

@app.post("/analyze")
async def analyze(request: Request):
    try: df = pd.read_csv(io.BytesIO(await request.body()), low_memory=False, nrows=20000)   # cap rows for memory
    except Exception: raise HTTPException(400, "Could not read this file as CSV")
    df.columns = df.columns.str.strip()
    truth = df.pop("Label").astype(str).str.strip().tolist() if "Label" in df.columns else None
    missing = [f for f in M["features"] if f not in df.columns]
    if len(missing) == len(M["features"]): raise HTTPException(400, "CSV has none of the model's feature columns: " + ", ".join(M["features"]))
    res = score(df); by_label, by_sev = {}, {}
    for r in res:
        by_label[r["label"]] = by_label.get(r["label"], 0) + 1; by_sev[r["severity"]] = by_sev.get(r["severity"], 0) + 1
    flagged = sorted(({"row": i, **r} for i, r in enumerate(res) if r["severity"] != "none"), key=lambda r: -r["risk"])[:100]
    out = {"rows": len(res), "missing_features": missing, "byLabel": by_label, "bySeverity": by_sev, "flagged": flagged}
    if truth: out["accuracy"] = round(float(np.mean([t == r["label"] for t, r in zip(truth, res)])), 4)
    return out
