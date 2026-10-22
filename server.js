const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "service-progress.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  overall_progress INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO project (id, name, start_date, overall_progress) VALUES (1, '', '', 0);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_date TEXT NOT NULL,
  technicians TEXT NOT NULL,
  activity TEXT NOT NULL,
  daily_progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Em andamento',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
    cb(null, crypto.randomUUID() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      return cb(new Error("Envie somente imagens JPG, PNG, WEBP ou GIF."));
    }
    cb(null, true);
  }
});

function cleanInt(value, min = 0, max = 100) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
}
function entryJson(row) {
  const photos = db.prepare("SELECT id, original_name AS name, '/api/photos/' || id AS url FROM photos WHERE entry_id = ? ORDER BY id").all(row.id);
  return { ...row, photos };
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/project", (_req, res) => {
  res.json(db.prepare("SELECT name, start_date AS startDate, overall_progress AS overallProgress, updated_at AS updatedAt FROM project WHERE id = 1").get());
});
app.put("/api/project", (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 180);
  const startDate = String(req.body.startDate || "").slice(0, 10);
  const overallProgress = cleanInt(req.body.overallProgress);
  db.prepare("UPDATE project SET name = ?, start_date = ?, overall_progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
    .run(name, startDate, overallProgress);
  res.json({ ok: true });
});
app.get("/api/entries", (_req, res) => {
  const rows = db.prepare("SELECT id, service_date AS date, technicians, activity, daily_progress AS progress, status, created_at AS createdAt FROM entries ORDER BY service_date DESC, id DESC").all();
  res.json(rows.map(entryJson));
});
app.post("/api/entries", (req, res) => {
  const date = String(req.body.date || "").slice(0, 10);
  const technicians = String(req.body.technicians || "").trim().slice(0, 500);
  const activity = String(req.body.activity || "").trim().slice(0, 10000);
  const status = String(req.body.status || "Em andamento");
  const allowed = ["Em andamento", "Concluído", "Paralisado", "Aguardando material", "Aguardando aprovação"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !technicians || !activity || !allowed.includes(status)) {
    return res.status(400).json({ error: "Preencha data, técnicos, atividade e uma situação válida." });
  }
  const result = db.prepare("INSERT INTO entries (service_date, technicians, activity, daily_progress, status) VALUES (?, ?, ?, ?, ?)")
    .run(date, technicians, activity, cleanInt(req.body.progress), status);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});
app.post("/api/entries/:id/photos", (req, res, next) => {
  upload.array("photos", 12)(req, res, err => {
    if (err) return next(err);
    const id = Number(req.params.id);
    const entry = db.prepare("SELECT id FROM entries WHERE id = ?").get(id);
    if (!entry) {
      for (const f of req.files || []) fs.rmSync(f.path, { force: true });
      return res.status(404).json({ error: "Registro não encontrado." });
    }
    const insert = db.prepare("INSERT INTO photos (entry_id, stored_name, original_name, mime_type) VALUES (?, ?, ?, ?)");
    const tx = db.transaction(files => files.forEach(f => insert.run(id, f.filename, path.basename(f.originalname).slice(0, 200), f.mimetype)));
    tx(req.files || []);
    res.json({ ok: true, count: (req.files || []).length });
  });
});
app.get("/api/photos/:id", (req, res) => {
  const photo = db.prepare("SELECT stored_name, original_name, mime_type FROM photos WHERE id = ?").get(Number(req.params.id));
  if (!photo) return res.status(404).send("Foto não encontrada.");
  const file = path.join(UPLOAD_DIR, path.basename(photo.stored_name));
  if (!fs.existsSync(file)) return res.status(404).send("Arquivo da foto não encontrado.");
  res.type(photo.mime_type);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(photo.original_name)}`);
  res.sendFile(file);
});
app.delete("/api/entries/:id", (req, res) => {
  const id = Number(req.params.id);
  const photos = db.prepare("SELECT stored_name FROM photos WHERE entry_id = ?").all(id);
  const result = db.prepare("DELETE FROM entries WHERE id = ?").run(id);
  for (const p of photos) fs.rmSync(path.join(UPLOAD_DIR, path.basename(p.stored_name)), { force: true });
  if (!result.changes) return res.status(404).json({ error: "Registro não encontrado." });
  res.json({ ok: true });
});
app.get("/api/export", (_req, res) => {
  const project = db.prepare("SELECT name, start_date AS startDate, overall_progress AS overallProgress FROM project WHERE id = 1").get();
  const entries = db.prepare("SELECT id, service_date AS date, technicians, activity, daily_progress AS progress, status, created_at AS createdAt FROM entries ORDER BY service_date DESC, id DESC").all().map(entryJson);
  res.json({ app: "Diário de Progresso do Serviço", version: 1, exportedAt: new Date().toISOString(), project, entries });
});
app.use(express.static(path.join(__dirname, "public")));
app.use((err, _req, res, _next) => {
  console.error(err.message);
  const status = err instanceof multer.MulterError ? 400 : 400;
  res.status(status).json({ error: err.message || "Erro ao processar a solicitação." });
});
app.listen(PORT, () => console.log(`Sistema disponível na porta ${PORT}`));
