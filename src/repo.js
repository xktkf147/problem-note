const { deriveStatus } = require('./status');

// t는 db.tx 안에서 받은 트랜잭션 연결({ query })이다.
async function insertAttempt(t, problemId, v) {
  const { rows } = await t.query(
    'SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next FROM attempts WHERE problem_id = $1',
    [problemId]
  );
  await t.query(
    'INSERT INTO attempts (problem_id, attempt_no, solution, result, reason) VALUES ($1, $2, $3, $4, $5)',
    [problemId, rows[0].next, v.solution, v.result, v.reason]
  );
  return rows[0].next;
}

// 문제와 첫 시도를 한 트랜잭션으로 저장하고 새 문제 id를 돌려준다.
// 같은 과목의 동시 저장은 advisory lock으로 줄 세워 과목별 번호가 겹치지 않게 한다.
// (최종 안전망은 UNIQUE (subject, number))
function createProblem(db, v) {
  return db.tx(async (t) => {
    await t.query('SELECT pg_advisory_xact_lock(hashtext($1))', [v.subject]);
    const { rows: num } = await t.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next FROM problems WHERE subject = $1',
      [v.subject]
    );
    const { rows } = await t.query(
      'INSERT INTO problems (subject, number, content) VALUES ($1, $2, $3) RETURNING id',
      [v.subject, num[0].next, v.content]
    );
    await insertAttempt(t, rows[0].id, v);
    return rows[0].id;
  });
}

// 기존 문제에 새 시도를 덧붙인다. 문제가 없으면 null.
// 그 문제 행을 잠가 같은 문제의 동시 시도 추가가 번호를 겹치지 않게 한다.
function addAttempt(db, problemId, v) {
  return db.tx(async (t) => {
    const { rows } = await t.query('SELECT id FROM problems WHERE id = $1 FOR UPDATE', [problemId]);
    if (rows.length === 0) return null;
    return insertAttempt(t, problemId, v);
  });
}

// 문제 + 시도 목록(시도 순서대로) + 파생 상태. 없으면 null.
async function getProblem(db, id) {
  const { rows } = await db.query('SELECT * FROM problems WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  const { rows: attempts } = await db.query(
    'SELECT * FROM attempts WHERE problem_id = $1 ORDER BY attempt_no',
    [id]
  );
  return { ...rows[0], attempts, status: deriveStatus(attempts.map((a) => a.result)) };
}

// 최신순 문제 목록(시도 횟수·파생 상태 포함). onlyWrong이면 상태가 '틀림'인 문제만.
async function listProblems(db, { onlyWrong = false } = {}) {
  const { rows: problems } = await db.query('SELECT * FROM problems ORDER BY created_at DESC, id DESC');
  const { rows } = await db.query('SELECT problem_id, result FROM attempts ORDER BY problem_id, attempt_no');
  const resultsByProblem = new Map();
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
async function getSummary(db, now = new Date()) {
  const summary = { Java: 0, DB: 0, today: 0 };
  const { rows } = await db.query('SELECT subject, COUNT(*)::int AS n FROM problems GROUP BY subject');
  for (const { subject, n } of rows) summary[subject] = n;
  const { rows: today } = await db.query(
    `SELECT COUNT(DISTINCT problem_id)::int AS n FROM attempts
     WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = ($1::timestamptz AT TIME ZONE 'Asia/Seoul')::date`,
    [now.toISOString()]
  );
  summary.today = today[0].n;
  return summary;
}

module.exports = { createProblem, addAttempt, getProblem, listProblems, getSummary };
