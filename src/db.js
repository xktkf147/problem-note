const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS problems (
  id         INTEGER PRIMARY KEY,
  subject    TEXT NOT NULL CHECK (subject IN ('Java', 'DB')),
  number     INTEGER NOT NULL,
  content    TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TEXT NOT NULL,
  UNIQUE (subject, number)
);

CREATE TABLE IF NOT EXISTS attempts (
  id         INTEGER PRIMARY KEY,
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  attempt_no INTEGER NOT NULL,
  solution   TEXT NOT NULL CHECK (length(trim(solution)) > 0),
  result     TEXT NOT NULL CHECK (result IN ('맞음', '틀림')),
  reason     TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (problem_id, attempt_no),
  CHECK (result = '맞음' OR length(trim(coalesce(reason, ''))) > 0)
);

CREATE TRIGGER IF NOT EXISTS attempts_no_update
BEFORE UPDATE ON attempts
BEGIN
  SELECT RAISE(ABORT, '지난 시도는 수정할 수 없습니다');
END;

CREATE TRIGGER IF NOT EXISTS attempts_no_delete
BEFORE DELETE ON attempts
BEGIN
  SELECT RAISE(ABORT, '지난 시도는 삭제할 수 없습니다');
END;
`;

// 연결을 열 때마다 외래키를 켜고(SQLite 기본값은 꺼짐), 그 다음에 스키마를 만든다.
function openDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
