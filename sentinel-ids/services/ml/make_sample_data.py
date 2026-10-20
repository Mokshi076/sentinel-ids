"""Synthetic CICIDS-like data so the stack runs without downloading anything."""
import numpy as np, pandas as pd, os
r = np.random.default_rng(42)
def gen(label, k):
    if label == "BENIGN":
        d = dict(dur=r.lognormal(11,2,k), fwd=r.poisson(8,k), bwd=r.poisson(8,k), bps=r.lognormal(8,2,k),
                 pps=r.lognormal(3,1.5,k), plen=r.normal(150,60,k), syn=r.binomial(1,.1,k), port=r.choice([80,443,53,22,8080],k))
    elif label == "DoS":
        d = dict(dur=r.lognormal(9,1,k), fwd=r.poisson(400,k), bwd=r.poisson(1,k), bps=r.lognormal(14,1,k),
                 pps=r.lognormal(9,1,k), plen=r.normal(40,10,k), syn=r.binomial(1,.9,k), port=r.choice([80,443],k))
    elif label == "PortScan":
        d = dict(dur=r.lognormal(4,1,k), fwd=r.integers(1,3,k), bwd=r.integers(0,2,k), bps=r.lognormal(6,1,k),
                 pps=r.lognormal(6,1,k), plen=r.normal(20,8,k), syn=np.ones(k), port=r.integers(1,65535,k))
    else:
        d = dict(dur=r.lognormal(10,1,k), fwd=r.poisson(15,k), bwd=r.poisson(12,k), bps=r.lognormal(7,1,k),
                 pps=r.lognormal(2,1,k), plen=r.normal(70,15,k), syn=r.binomial(1,.3,k), port=r.choice([21,22],k))
    return pd.DataFrame({"Flow Duration":d["dur"],"Total Fwd Packets":d["fwd"],"Total Backward Packets":d["bwd"],
        "Flow Bytes/s":d["bps"],"Flow Packets/s":d["pps"],"Packet Length Mean":d["plen"],
        "SYN Flag Count":d["syn"],"Destination Port":d["port"],"Label":label})
n = 30000
df = pd.concat([gen("BENIGN",int(n*.8)), gen("DoS",int(n*.08)), gen("PortScan",int(n*.07)), gen("BruteForce",int(n*.05))])
df = df.sample(frac=1, random_state=1).reset_index(drop=True)
df.loc[df.sample(frac=.02, random_state=2).index, "Flow Bytes/s"] = np.nan
df.loc[df.sample(frac=.005, random_state=3).index, "Flow Packets/s"] = np.inf
os.makedirs("../../data", exist_ok=True); df.to_csv("../../data/sample.csv", index=False); print(df.Label.value_counts())
