require('dotenv').config();
const express = require('express');
const { openDb } = require('./db');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/notes.db';

const db = openDb(DB_PATH);
const app = express();

// 1단계 확인용 임시 페이지. 3~4단계에서 실제 목록 화면으로 교체한다.
app.get('/', (req, res) => {
  const fk = db.prepare('PRAGMA foreign_keys').get().foreign_keys;
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name")
    .all()
    .map((r) => r.name);
  res.type('text/plain; charset=utf-8').send(
    `문제 풀이 노트 - 서버 동작 중\nforeign_keys = ${fk}\n테이블/트리거: ${tables.join(', ')}\n`
  );
});

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
