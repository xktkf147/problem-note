const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./helpers/testDb');
const { schemaSql, sslOptions, createPgDb } = require('../src/db');

const NOW_PROBLEM = `INSERT INTO problems (subject, number, content) VALUES ('Java', 1, 'q')`;
const attempt = (problemId, no, result, reason, solution = 's') => [
  `INSERT INTO attempts (problem_id, attempt_no, solution, result, reason) VALUES ($1, $2, $3, $4, $5)`,
  [problemId, no, solution, result, reason],
];

// 오류 코드(예: 23514)나 메시지로 거부 사유를 확인한다.
const rejects = (promise, expected) =>
  assert.rejects(promise, (e) => (typeof expected === 'string' ? e.code === expected : expected.test(e.message)));

async function withDb(fn) {
  const db = await createTestDb();
  try {
    await fn(db);
  } finally {
    await db.close();
  }
}

test('정상 입력은 저장된다(맞음은 이유 없이, 틀림은 이유와 함께)', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await db.query(...attempt(1, 1, '틀림', '문법 오류'));
    await db.query(...attempt(1, 2, '맞음', null));
    const { rows } = await db.query('SELECT count(*)::int AS n FROM attempts');
    assert.equal(rows[0].n, 2);
  }));

test('과목은 Java/DB만 허용', () =>
  withDb(async (db) => {
    await rejects(db.query(`INSERT INTO problems (subject, number, content) VALUES ('Python', 1, 'q')`), '23514');
    await db.query(`INSERT INTO problems (subject, number, content) VALUES ('DB', 1, 'q')`);
  }));

test('문제 내용이 비거나 공백·줄바꿈·탭뿐이면 거부', () =>
  withDb(async (db) => {
    for (const bad of ['', '   ', '\n\n', ' \t\r\n ']) {
      await rejects(db.query(`INSERT INTO problems (subject, number, content) VALUES ('Java', 1, $1)`, [bad]), '23514');
    }
  }));

test('풀이가 비거나 공백·줄바꿈뿐이면 거부', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    for (const bad of ['', '  ', '\n\t\n']) {
      await rejects(db.query(...attempt(1, 1, '맞음', null, bad)), '23514');
    }
  }));

test('틀림인데 이유가 null/빈 값/공백·줄바꿈뿐이면 거부', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    for (const bad of [null, '', '   ', '\n\t']) {
      await rejects(db.query(...attempt(1, 1, '틀림', bad)), '23514');
    }
  }));

test('결과는 맞음/틀림만 허용', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await rejects(db.query(...attempt(1, 1, '통과', null)), '23514');
  }));

test('존재하지 않는 problem_id는 외래키로 거부', () =>
  withDb(async (db) => {
    await rejects(db.query(...attempt(99, 1, '맞음', null)), '23503');
  }));

test('같은 과목 번호·같은 문제의 시도 번호는 중복 불가', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await rejects(db.query(NOW_PROBLEM), '23505');
    await db.query(...attempt(1, 1, '맞음', null));
    await rejects(db.query(...attempt(1, 1, '맞음', null)), '23505');
  }));

test('지난 시도는 UPDATE·DELETE·TRUNCATE 모두 거부', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await db.query(...attempt(1, 1, '틀림', '이유'));
    await rejects(db.query(`UPDATE attempts SET result = '맞음'`), /수정할 수 없습니다/);
    await rejects(db.query(`UPDATE attempts SET solution = 'x' WHERE id = 1`), /수정할 수 없습니다/);
    await rejects(db.query('DELETE FROM attempts'), /삭제할 수 없습니다/);
    await rejects(db.query('TRUNCATE attempts'), /삭제할 수 없습니다/);
    const { rows } = await db.query('SELECT result, reason FROM attempts');
    assert.deepEqual(rows, [{ result: '틀림', reason: '이유' }]);
  }));

test('시도가 있는 문제는 삭제할 수 없다(외래키)', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await db.query(...attempt(1, 1, '맞음', null));
    await rejects(db.query('DELETE FROM problems WHERE id = 1'), '23503');
  }));

test('트랜잭션 중간에 실패하면 전부 롤백된다', () =>
  withDb(async (db) => {
    await rejects(
      db.tx(async (t) => {
        await t.query(NOW_PROBLEM);
        await t.query(...attempt(1, 1, '틀림', null)); // 이유 없음 -> CHECK 위반
      }),
      '23514'
    );
    const { rows } = await db.query('SELECT count(*)::int AS n FROM problems');
    assert.equal(rows[0].n, 0);
  }));

test('트랜잭션이 성공하면 문제와 시도가 함께 저장된다', () =>
  withDb(async (db) => {
    const id = await db.tx(async (t) => {
      const { rows } = await t.query(`INSERT INTO problems (subject, number, content) VALUES ('Java', 1, 'q') RETURNING id`);
      await t.query(...attempt(rows[0].id, 1, '맞음', null));
      return rows[0].id;
    });
    const { rows } = await db.query('SELECT count(*)::int AS n FROM attempts WHERE problem_id = $1', [id]);
    assert.equal(rows[0].n, 1);
  }));

test('스키마는 여러 번 적용해도 안전하고 규칙(트리거)이 유지된다', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await db.query(...attempt(1, 1, '맞음', null));
    await db.exec(schemaSql());
    await db.exec(schemaSql());
    await rejects(db.query('DELETE FROM attempts'), /삭제할 수 없습니다/);
    await rejects(db.query('TRUNCATE attempts'), /삭제할 수 없습니다/);
  }));

test('오늘(KST) 계산: AT TIME ZONE으로 UTC 14:59와 15:00의 날짜가 갈린다', () =>
  withDb(async (db) => {
    await db.query(NOW_PROBLEM);
    await db.query(`INSERT INTO attempts (problem_id, attempt_no, solution, result, created_at)
                    VALUES (1, 1, 's', '맞음', '2026-11-03T14:59:59Z'), (1, 2, 's', '맞음', '2026-11-03T15:00:00Z')`);
    const count = async (now) =>
      (await db.query(
        `SELECT count(*)::int AS n FROM attempts
         WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = ($1::timestamptz AT TIME ZONE 'Asia/Seoul')::date`,
        [now]
      )).rows[0].n;
    assert.equal(await count('2026-11-03T10:00:00Z'), 1); // KST 11/03
    assert.equal(await count('2026-11-03T15:30:00Z'), 1); // KST 11/04
    assert.equal(await count('2026-11-05T00:00:00Z'), 0);
  }));

test('SSL: Supabase CA 인증서로 검증하고 rejectUnauthorized를 끄지 않는다', () => {
  const ssl = sslOptions();
  assert.equal(ssl.rejectUnauthorized, true);
  assert.match(ssl.ca, /BEGIN CERTIFICATE/);
  assert.doesNotMatch(ssl.ca, /PRIVATE KEY/);
});

test('연결 풀의 error 이벤트가 프로세스를 죽이지 않고 로그만 남긴다', async () => {
  const db = createPgDb('postgres://x:x@127.0.0.1:1/x');
  const logged = [];
  const orig = console.error;
  console.error = (m) => logged.push(m);
  try {
    // 처리기가 없으면 EventEmitter가 이 오류를 그대로 던진다.
    assert.doesNotThrow(() => db.pool.emit('error', Object.assign(new Error('연결이 끊어졌습니다'), { code: '57P01' })));
  } finally {
    console.error = orig;
    await db.close();
  }
  assert.equal(logged.length, 1);
  assert.match(logged[0], /57P01.*연결이 끊어졌습니다/);
});

test('createPgDb: 연결 없이 만들 수 있고(풀은 지연 연결), 잘못된 스키마 이름은 거부', async () => {
  const db = createPgDb('postgres://x:x@127.0.0.1:1/x');
  await db.close();
  assert.throws(() => createPgDb('postgres://x:x@127.0.0.1:1/x', { schema: 'a; DROP TABLE x' }), /스키마 이름/);
});
