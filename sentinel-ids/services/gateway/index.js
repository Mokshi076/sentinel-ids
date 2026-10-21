import express from "express"; import http from "http"; import { Server } from "socket.io";
import { Kafka } from "kafkajs"; import pg from "pg"; import { MongoClient } from "mongodb"; import prom from "prom-client"; import jwt from "jsonwebtoken";
process.on("unhandledRejection", e => console.error("unhandled:", e?.message || e));

const env = (k, d) => process.env[k] ?? d;
const ML = env("ML_URL", "http://localhost:8000"), CHUNK = +env("ML_BATCH", 256);
const app = express(), server = http.createServer(app), io = new Server(server, { cors: { origin: "*" } });

// ---- Prometheus metrics ----
prom.collectDefaultMetrics();
const ingest = new prom.Counter({ name: "ingest_events_total", help: "Events consumed from Kafka" });
const threats = new prom.Counter({ name: "threats_total", help: "Flagged events", labelNames: ["label", "severity"] });
const errs = new prom.Counter({ name: "prediction_errors_total", help: "Failed inference batches" });
const inf = new prom.Histogram({ name: "inference_roundtrip_seconds", help: "ML call latency", buckets: [.005,.01,.025,.05,.1,.25,.5,1,2] });
const batchSz = new prom.Histogram({ name: "kafka_batch_size", help: "Messages per fetch", buckets: [1,10,50,100,500,1000,5000] });
const httpLat = new prom.Histogram({ name: "http_request_duration_seconds", help: "API latency", labelNames: ["route"], buckets: [.005,.01,.05,.1,.5,1] });

const pool = new pg.Pool({ connectionString: env("PG_URL"), max: 10 });
const mongo = new MongoClient(env("MONGO_URL"));
let raw;

// ---- 1s aggregation window: browser gets one small message/sec, never the raw firehose ----
const newWin = () => ({ total: 0, threats: 0, sev: { high: 0, medium: 0, low: 0 }, lab: {}, flagged: [], benign: [] });
let win = newWin();
setInterval(() => {
  const w = win; win = newWin();
  const feed = [...w.flagged.sort((a, b) => b.risk - a.risk).slice(0, 15), ...w.benign.slice(0, 5)];
  io.emit("tick", { ts: Date.now(), total: w.total, threats: w.threats, bySeverity: w.sev, byLabel: w.lab, feed });
}, 1000);

async function score(events) {                 // chunked so one big Kafka fetch never becomes one huge HTTP call
  const out = [];
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK), end = inf.startTimer();
    try {
      const r = await fetch(ML + "/predict", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: chunk.map(e => e.features) }) });
      if (!r.ok) throw new Error("ML " + r.status);
      const { results } = await r.json(); end();
      chunk.forEach((e, j) => out.push({ id: e.id, src_ip: e.src_ip, ts: Date.now(), ...results[j] }));
    } catch (e) { end(); errs.inc(); console.error("inference failed:", e.message); }   // drop batch, keep consuming
  }
  return out;
}

const INSERT = `INSERT INTO events(ts,src_ip,label,risk,severity,anomaly)
  SELECT * FROM unnest($1::timestamptz[],$2::text[],$3::text[],$4::float8[],$5::text[],$6::bool[])`;

async function handle(events) {
  batchSz.observe(events.length); ingest.inc(events.length);
  raw.insertMany(events.map(e => ({ ...e, _at: new Date() })), { ordered: false }).catch(e => console.error("mongo:", e.message));
  const s = await score(events); if (!s.length) return;
  pool.query(INSERT, [s.map(e => new Date(e.ts)), s.map(e => e.src_ip), s.map(e => e.label), s.map(e => e.risk),
    s.map(e => e.severity), s.map(e => e.anomaly)]).catch(e => console.error("pg:", e.message));
  for (const e of s) {
    win.total++;
    if (e.severity === "none") { if (win.benign.length < 5) win.benign.push(e); continue; }
    win.threats++; win.sev[e.severity]++; win.lab[e.label] = (win.lab[e.label] || 0) + 1;
    threats.inc({ label: e.label, severity: e.severity }); if (win.flagged.length < 200) win.flagged.push(e);
  }
}

// ---- REST + auth ----
const SECRET = env("JWT_SECRET", "change-me"), AU = env("ADMIN_USER", "admin"), AP = env("ADMIN_PASS", "sentinel123");
const auth = (req, res, next) => { try { jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), SECRET); next(); } catch { res.status(401).json({ error: "unauthorized" }); } };
io.use((s, next) => { try { jwt.verify(s.handshake.auth?.token, SECRET); next(); } catch { next(new Error("unauthorized")); } });
app.use((req, res, next) => {
  res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
  if (req.method === "OPTIONS") return res.sendStatus(204); next(); });
app.use(express.json());
app.use((req, res, next) => { const end = httpLat.startTimer(); res.on("finish", () => end({ route: req.path })); next(); });
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/metrics", async (_, res) => { res.set("content-type", prom.register.contentType); res.end(await prom.register.metrics()); });
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === AU && password === AP) return res.json({ token: jwt.sign({ u: username }, SECRET, { expiresIn: "8h" }) });
  res.status(401).json({ error: "Invalid username or password" }); });
app.get("/api/history", auth, async (req, res) => {
  const m = Math.min(+req.query.minutes || 30, 1440);
  const { rows } = await pool.query(`SELECT time_bucket('10 seconds',ts) AS t, count(*)::int AS total,
    count(*) FILTER (WHERE severity<>'none')::int AS threats FROM events WHERE ts > now() - ($1||' minutes')::interval GROUP BY t ORDER BY t`, [m]);
  res.json(rows); });
app.get("/api/alerts", auth, async (req, res) => {
  const { severity, label, q } = req.query, where = ["severity<>'none'"], args = [];
  if (severity) { args.push(severity); where.push(`severity=$${args.length}`); }
  if (label) { args.push(label); where.push(`label=$${args.length}`); }
  if (q) { args.push(`%${q}%`); where.push(`src_ip ILIKE $${args.length}`); }
  args.push(Math.min(+req.query.limit || 25, 500), +req.query.offset || 0);
  const { rows } = await pool.query(`SELECT * FROM events WHERE ${where.join(" AND ")} ORDER BY ts DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args);
  res.json(rows); });
app.get("/api/model-report", auth, async (_, res) => {
  try { const r = await fetch(ML + "/report"); res.status(r.status).json(await r.json()); } catch { res.status(502).json({ error: "ML service unavailable" }); } });
app.post("/api/analyze", auth, express.text({ type: "*/*", limit: "30mb" }), async (req, res) => {
  try { const r = await fetch(ML + "/analyze", { method: "POST", headers: { "content-type": "text/csv" }, body: req.body }); res.status(r.status).json(await r.json()); }
  catch { res.status(502).json({ error: "ML service unavailable" }); } });

// ---- boot ----
await mongo.connect(); raw = mongo.db("ids").collection("raw_events");
await raw.createIndex({ _at: 1 }, { expireAfterSeconds: 86400 });          // raw payloads auto-expire after 24h
const consumer = new Kafka({ clientId: "ids-gateway", brokers: env("KAFKA_BROKERS", "localhost:9092").split(",") }).consumer({ groupId: "ids-gateway", retry: { restartOnFailure: async (e) => { console.error("consumer crashed, restarting:", e.message); return true; } } });
await consumer.connect(); await consumer.subscribe({ topic: "raw-events", fromBeginning: false });
await consumer.run({ eachBatch: async ({ batch }) => {
  const events = batch.messages.map(m => { try { return JSON.parse(m.value.toString()); } catch { return null; } }).filter(Boolean);
  await handle(events);
}});
server.listen(+env("PORT", 3001), () => console.log("gateway up"));
