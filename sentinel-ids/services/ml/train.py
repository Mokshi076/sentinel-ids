"""Usage: python train.py <csv-or-folder>   (CICIDS2017: pass the folder of CSVs)"""
import sys, os, glob, joblib, numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

src = sys.argv[1] if len(sys.argv) > 1 else "../../data/sample.csv"
files = sorted(glob.glob(os.path.join(src, "*.csv"))) if os.path.isdir(src) else [src]
df = pd.concat((pd.read_csv(f, low_memory=False) for f in files), ignore_index=True)
df.columns = df.columns.str.strip()
df = df.replace([np.inf, -np.inf], np.nan).drop_duplicates()
y_raw = df.pop("Label").str.strip()
FEATURES = list(df.select_dtypes("number").columns)
X = df[FEATURES].astype("float32")
le = LabelEncoder(); y = le.fit_transform(y_raw)

Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
prep = Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())])
Xtr_s = prep.fit_transform(Xtr); Xte_s = prep.transform(Xte)

# 1) supervised: known attacks (class weights handle imbalance)
clf = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, tree_method="hist", n_jobs=-1, eval_metric="mlogloss")
clf.fit(Xtr_s, ytr, sample_weight=compute_sample_weight("balanced", ytr))
pred = clf.predict(Xte_s)
print(classification_report(yte, pred, target_names=le.classes_))
import json
from sklearn.metrics import confusion_matrix
REPORT = {"source": ", ".join(os.path.basename(f) for f in files[:5]), "rows": int(len(df)), "test_rows": int(len(yte)),
          "labels": list(le.classes_), "report": classification_report(yte, pred, target_names=le.classes_, output_dict=True),
          "confusion": confusion_matrix(yte, pred).tolist(),
          "importances": sorted(zip(FEATURES, map(float, clf.feature_importances_)), key=lambda x: -x[1])[:15]}

# 2) unsupervised: trained on BENIGN only -> flags zero-day outliers
benign = Xtr_s[ytr == le.transform(["BENIGN"])[0]]
iso = IsolationForest(n_estimators=200, contamination=0.01, n_jobs=-1, random_state=42).fit(benign)
thr = float(np.percentile(iso.score_samples(benign), 1))

os.makedirs("models", exist_ok=True)
joblib.dump(dict(prep=prep, clf=clf, iso=iso, le=le, features=FEATURES, iso_thr=thr), "models/ids.joblib")
json.dump(REPORT, open("models/report.json", "w"))
print("saved models/ids.joblib with", len(FEATURES), "features")
