import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
  import { join, dirname } from 'path';
  import { fileURLToPath } from 'url';

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const DATA_DIR = join(__dirname, '..', 'data');
  const DB_FILE  = join(DATA_DIR, 'db.json');

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  function load() {
    if (!existsSync(DB_FILE)) return { warnings: {}, events: [] };
    try { return JSON.parse(readFileSync(DB_FILE, 'utf8')); }
    catch { return { warnings: {}, events: [] }; }
  }

  function save(data) {
    writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }

  function weekAgo() {
    return Date.now() - 7 * 24 * 60 * 60 * 1000;
  }

  export function recordEvent(guildId, type, userId = null) {
    const db = load();
    if (!db.events) db.events = [];
    db.events.push({ guildId, type, userId, ts: Date.now() });
    const cutoff = weekAgo() - 24 * 60 * 60 * 1000;
    db.events = db.events.filter(e => e.ts > cutoff);
    save(db);
  }

  export function getWeeklyStats(guildId) {
    const db = load();
    const cut = weekAgo();
    const recent = (db.events ?? []).filter(e => e.guildId === guildId && e.ts > cut);
    return {
      messages:    recent.filter(e => e.type === 'message').length,
      joins:       recent.filter(e => e.type === 'join').length,
      leaves:      recent.filter(e => e.type === 'leave').length,
      punishments: recent.filter(e => e.type === 'punishment').length,
    };
  }

  export function getWarnings(guildId, userId) {
    const db = load();
    return db.warnings[`${guildId}:${userId}`] || [];
  }

  export function addWarning(guildId, userId, reason, moderatorId) {
    const db = load();
    const key = `${guildId}:${userId}`;
    if (!db.warnings[key]) db.warnings[key] = [];
    db.warnings[key].push({ reason, moderatorId, timestamp: Date.now() });
    save(db);
    recordEvent(guildId, 'warn', userId);
    recordEvent(guildId, 'punishment', userId);
    return db.warnings[key];
  }

  export function clearWarnings(guildId, userId) {
    const db = load();
    db.warnings[`${guildId}:${userId}`] = [];
    save(db);
  }
  