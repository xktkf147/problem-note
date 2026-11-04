const { deriveStatus } = require('./status');

function inTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function insertAttempt(db, problemId, v) {
  const { next } = db
    .prepare('SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next FROM attempts WHERE problem_id = ?')
    .get(problemId);
  db.prepare(
    'INSERT INTO attempts (problem_id, attempt_no, solution, result, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(problemId, next, v.solution, v.result, v.reason, new Date().toISOString());
  return next;
}

// 문제와 첫 시도를 한 트랜잭션으로 저장하고 새 문제 id를 돌려준다.
function createProblem(db, v) {
  return inTransaction(db, () => {
    const { next } = db
      .prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM problems WHERE subject = ?')
      .get(v.subject);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO problems (subject, number, content, created_at) VALUES (?, ?, ?, ?)')
      .run(v.subject, next, v.content, new Date().toISOString());
    insertAttempt(db, Number(lastInsertRowid), v);
    return Number(lastInsertRowid);
  });
}

// 기존 문제에 새 시도를 덧붙인다. 문제가 없으면 null.
function addAttempt(db, problemId, v) {
  return inTransaction(db, () => {
    if (!db.prepare('SELECT 1 FROM problems WHERE id = ?').get(problemId)) return null;
    return insertAttempt(db, problemId, v);
  });
}

// 문제 + 시도 목록(시도 순서대로) + 파생 상태. 없으면 null.
function getProblem(db, id) {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(id);
  if (!problem) return null;
  const attempts = db
    .prepare('SELECT * FROM attempts WHERE problem_id = ? ORDER BY attempt_no')
    .all(id);
  return { ...problem, attempts, status: deriveStatus(attempts.map((a) => a.result)) };
}

// 최신순 문제 목록(시도 횟수·파생 상태 포함). onlyWrong이면 상태가 '틀림'인 문제만.
function listProblems(db, { onlyWrong = false } = {}) {
  const problems = db.prepare('SELECT * FROM problems ORDER BY created_at DESC, id DESC').all();
  const resultsByProblem = new Map();
  const rows = db.prepare('SELECT problem_id, result FROM attempts ORDER BY problem_id, attempt_no').all();
  for (const { problem_id, result } of rows) {
    if (!resultsByProblem.has(problem_id)) resultsByProblem.set(problem_id, []);
    resultsByProblem.get(problem_id).push(result);
  }
  const list = problems.map((p) => {
    const results = resultsByProblem.get(p.id) || [];
    return { ...p, attemptCount: results.length, status: deriveStatus(results) };
  });
  return onlyWrong ? list.filter((p) => p.status === '틀림') : list;
}

// 과목별 푼 문제 수와 오늘(한국 시간) 푼 문제 수.
// 오늘 푼 문제 = 오늘 시도가 하나라도 있는 서로 다른 문제(다시 푼 문제 포함).
function getSummary(db, now = new Date()) {
  const summary = { Java: 0, DB: 0, today: 0 };
  for (const { subject, n } of db.prepare('SELECT subject, COUNT(*) AS n FROM problems GROUP BY subject').all()) {
    summary[subject] = n;
  }
  summary.today = db
    .prepare(
      `SELECT COUNT(DISTINCT problem_id) AS n FROM attempts
       WHERE date(created_at, '+9 hours') = date(?, '+9 hours')`
    )
    .get(now.toISOString()).n;
  return summary;
}

module.exports = { createProblem, addAttempt, getProblem, listProblems, getSummary };
