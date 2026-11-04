const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const { createProblem, addAttempt, listProblems, getSummary } = require('../src/repo');
const { createApp } = require('../src/app');

const p = (subject, result, reason) => ({ subject, content: 'q', solution: 's', result, reason: result === '틀림' ? reason || 'r' : null });
const a = (result) => ({ solution: 's', result, reason: result === '틀림' ? 'r' : null });

function seed(db) {
  const j1 = createProblem(db, p('Java', '맞음')); // 맞음
  const j2 = createProblem(db, p('Java', '틀림')); // 틀림
  const d1 = createProblem(db, p('DB', '틀림')); // 해결
  addAttempt(db, d1, a('맞음'));
  const d2 = createProblem(db, p('DB', '맞음')); // 틀림 (맞음 -> 틀림)
  addAttempt(db, d2, a('틀림'));
  return { j1, j2, d1, d2 };
}

test('목록은 최신순, 상태·시도 횟수 포함', () => {
  const db = openDb(':memory:');
  const { j1, j2, d1, d2 } = seed(db);
  const list = listProblems(db);
  assert.deepEqual(list.map((x) => x.id), [d2, d1, j2, j1]);
  assert.deepEqual(list.map((x) => x.status), ['틀림', '해결', '틀림', '맞음']);
  assert.deepEqual(list.map((x) => x.attemptCount), [2, 2, 1, 1]);
});

test("틀린 문제만 보기는 상태가 '틀림'인 문제만 (해결·맞음 제외)", () => {
  const db = openDb(':memory:');
  const { j2, d2 } = seed(db);
  assert.deepEqual(listProblems(db, { onlyWrong: true }).map((x) => x.id), [d2, j2]);
});

test('과목별 문제 수와 오늘 푼 문제 수', () => {
  const db = openDb(':memory:');
  seed(db);
  assert.deepEqual(getSummary(db), { Java: 2, DB: 2, today: 4 });
});

test('오늘은 한국 시간 기준: UTC 14:59는 같은 날, 15:00은 다음 날', () => {
  const db = openDb(':memory:');
  const id1 = createProblem(db, p('Java', '맞음'));
  const id2 = createProblem(db, p('Java', '맞음'));
  const set = db.prepare('UPDATE problems SET created_at = ? WHERE id = ?');
  // attempts는 트리거로 수정 불가이므로 시각을 지정해 직접 삽입한다.
  db.exec('DROP TRIGGER attempts_no_update');
  const setAttempt = db.prepare('UPDATE attempts SET created_at = ? WHERE problem_id = ?');
  setAttempt.run('2026-11-03T14:59:59.000Z', id1); // KST 11/03 23:59
  setAttempt.run('2026-11-03T15:00:00.000Z', id2); // KST 11/04 00:00
  set.run('2026-11-03T14:59:59.000Z', id1);
  const at = (iso) => getSummary(db, new Date(iso)).today;
  assert.equal(at('2026-11-03T10:00:00.000Z'), 1); // KST 11/03 19:00 -> id1만
  assert.equal(at('2026-11-03T15:30:00.000Z'), 1); // KST 11/04 00:30 -> id2만
  assert.equal(at('2026-11-04T16:00:00.000Z'), 0); // KST 11/05 -> 없음
});

test('같은 문제를 오늘 여러 번 풀어도 오늘 푼 문제 수는 1', () => {
  const db = openDb(':memory:');
  const id = createProblem(db, p('Java', '틀림'));
  addAttempt(db, id, a('틀림'));
  addAttempt(db, id, a('맞음'));
  assert.equal(getSummary(db).today, 1);
});

test('홈 화면: 요약·목록·링크, filter=wrong이면 틀림만', async () => {
  const db = openDb(':memory:');
  const { j1, j2 } = seed(db);
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
  }
});

test('문제가 없으면 안내 문구', async () => {
  const server = createApp(openDb(':memory:')).listen(0);
  try {
    const html = await (await fetch(`http://localhost:${server.address().port}/`)).text();
    assert.match(html, /아직 기록한 문제가 없습니다/);
  } finally {
    server.close();
  }
});
