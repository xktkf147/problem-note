const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./helpers/testDb');
const { createProblem, addAttempt, listProblems, getSummary } = require('../src/repo');
const { createApp } = require('../src/app');

const p = (subject, result, reason) => ({ subject, content: 'q', solution: 's', result, reason: result === '틀림' ? reason || 'r' : null });
const a = (result) => ({ solution: 's', result, reason: result === '틀림' ? 'r' : null });

async function withDb(fn) {
  const db = await createTestDb();
  try {
    await fn(db);
  } finally {
    await db.close();
  }
}

async function seed(db) {
  const j1 = await createProblem(db, p('Java', '맞음')); // 맞음
  const j2 = await createProblem(db, p('Java', '틀림')); // 틀림
  const d1 = await createProblem(db, p('DB', '틀림')); // 해결
  await addAttempt(db, d1, a('맞음'));
  const d2 = await createProblem(db, p('DB', '맞음')); // 틀림 (맞음 -> 틀림)
  await addAttempt(db, d2, a('틀림'));
  return { j1, j2, d1, d2 };
}

test('목록은 최신순, 상태·시도 횟수 포함', () =>
  withDb(async (db) => {
    const { j1, j2, d1, d2 } = await seed(db);
    const list = await listProblems(db);
    assert.deepEqual(list.map((x) => x.id), [d2, d1, j2, j1]);
    assert.deepEqual(list.map((x) => x.status), ['틀림', '해결', '틀림', '맞음']);
    assert.deepEqual(list.map((x) => x.attemptCount), [2, 2, 1, 1]);
  }));

test("틀린 문제만 보기는 상태가 '틀림'인 문제만 (해결·맞음 제외)", () =>
  withDb(async (db) => {
    const { j2, d2 } = await seed(db);
    assert.deepEqual((await listProblems(db, { onlyWrong: true })).map((x) => x.id), [d2, j2]);
  }));

test('과목별 문제 수와 오늘 푼 문제 수', () =>
  withDb(async (db) => {
    await seed(db);
    assert.deepEqual(await getSummary(db), { Java: 2, DB: 2, today: 4 });
  }));

test('오늘은 한국 시간 기준: UTC 14:59는 같은 날, 15:00은 다음 날', () =>
  withDb(async (db) => {
    // 시도는 수정할 수 없으므로 시각을 지정해 직접 삽입한다.
    await db.exec(`INSERT INTO problems (subject, number, content) VALUES ('Java', 1, 'q'), ('Java', 2, 'q')`);
    await db.exec(`INSERT INTO attempts (problem_id, attempt_no, solution, result, created_at) VALUES
      (1, 1, 's', '맞음', '2026-11-03T14:59:59Z'),  -- KST 11/03 23:59
      (2, 1, 's', '맞음', '2026-11-03T15:00:00Z')   -- KST 11/04 00:00`);
    const at = async (iso) => (await getSummary(db, new Date(iso))).today;
    assert.equal(await at('2026-11-03T10:00:00.000Z'), 1); // KST 11/03 19:00 -> 문제 1만
    assert.equal(await at('2026-11-03T15:30:00.000Z'), 1); // KST 11/04 00:30 -> 문제 2만
    assert.equal(await at('2026-11-04T16:00:00.000Z'), 0); // KST 11/05 -> 없음
  }));

test('같은 문제를 오늘 여러 번 풀어도 오늘 푼 문제 수는 1', () =>
  withDb(async (db) => {
    const id = await createProblem(db, p('Java', '틀림'));
    await addAttempt(db, id, a('틀림'));
    await addAttempt(db, id, a('맞음'));
    assert.equal((await getSummary(db)).today, 1);
  }));

test('없는 문제에 시도를 추가하면 null이고 아무것도 저장되지 않는다', () =>
  withDb(async (db) => {
    assert.equal(await addAttempt(db, 99, a('맞음')), null);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM attempts')).rows[0].n, 0);
  }));

test('동시에 저장해도 과목별 번호가 겹치지 않는다 (PGlite는 연결 1개라 경합 자체는 재현하지 못함)', () =>
  withDb(async (db) => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => createProblem(db, p('Java', '맞음'))));
    assert.equal(new Set(ids).size, 10);
    const { rows } = await db.query(`SELECT number FROM problems WHERE subject = 'Java' ORDER BY number`);
    assert.deepEqual(rows.map((r) => r.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }));

test('홈 화면: 요약·목록·링크, filter=wrong이면 틀림만', async () => {
  const db = await createTestDb();
  const { j1, j2 } = await seed(db);
  const server = createApp(db).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    const all = await (await fetch(`${base}/`)).text();
    assert.match(all, /<strong>2<\/strong><span>Java 푼 문제/);
    assert.match(all, /<strong>4<\/strong><span>오늘 푼 문제/);
    assert.ok(all.includes(`href="/problems/${j1}"`));
    assert.ok(all.includes('해결'));
    const wrong = await (await fetch(`${base}/?filter=wrong`)).text();
    assert.ok(wrong.includes(`href="/problems/${j2}"`));
    assert.ok(!wrong.includes(`href="/problems/${j1}"`));
    assert.ok(!wrong.includes('badge-해결'));
    assert.ok(wrong.includes('전체 보기'));
  } finally {
    server.close();
    await db.close();
  }
});

test('문제가 없으면 안내 문구', async () => {
  const db = await createTestDb();
  const server = createApp(db).listen(0);
  try {
    const html = await (await fetch(`http://localhost:${server.address().port}/`)).text();
    assert.match(html, /아직 기록한 문제가 없습니다/);
  } finally {
    server.close();
    await db.close();
  }
});
