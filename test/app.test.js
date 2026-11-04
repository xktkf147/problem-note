const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('./helpers/testDb');
const { createApp } = require('../src/app');

async function withServer(fn) {
  const db = await createTestDb();
  const server = createApp(db).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base, db);
  } finally {
    server.close();
    await db.close();
  }
}

const count = async (db, table) => (await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;

const post = (url, data) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data),
    redirect: 'manual',
  });

const code = 'public class A {\n    int x;\n\tvoid f() {}\n}';

test('문제 기록 -> 상세 페이지, 과목별 번호, 코드 줄바꿈·이스케이프 유지', async () => {
  await withServer(async (base) => {
    const r1 = await post(`${base}/problems`, { subject: 'Java', content: '문제 <b>1</b>', solution: code, result: '맞음' });
    assert.equal(r1.status, 303);
    assert.equal(r1.headers.get('location'), '/problems/1');
    const r2 = await post(`${base}/problems`, { subject: 'DB', content: 'q', solution: 'SELECT 1', result: '맞음' });
    assert.equal(r2.headers.get('location'), '/problems/2');

    const html = await (await fetch(`${base}/problems/1`)).text();
    assert.match(html, /Java #1/);
    assert.ok(html.includes('<pre><code>public class A {\n    int x;\n\tvoid f() {}\n}</code></pre>'));
    assert.ok(html.includes('문제 &lt;b&gt;1&lt;/b&gt;'));
    assert.match(await (await fetch(`${base}/problems/2`)).text(), /DB #1/);
  });
});

test('틀림 -> 틀림 -> 맞음: 시도 1~3 순서대로, 이유 표시, 상태 해결', async () => {
  await withServer(async (base) => {
    await post(`${base}/problems`, { subject: 'Java', content: 'q', solution: 's1', result: '틀림', reason: '이유ONE' });
    await post(`${base}/problems/1/attempts`, { solution: 's2', result: '틀림', reason: '이유TWO' });
    await post(`${base}/problems/1/attempts`, { solution: 's3', result: '맞음' });
    const html = await (await fetch(`${base}/problems/1`)).text();
    const idx = ['시도 1', '시도 2', '시도 3'].map((s) => html.indexOf(`<h2>${s}`));
    assert.ok(idx.every((i) => i > 0) && idx[0] < idx[1] && idx[1] < idx[2]);
    assert.match(html, /이유ONE/);
    assert.match(html, /이유TWO/);
    assert.match(html, /badge-해결">해결/);
  });
});

test('틀린 이유 없이 틀림 저장은 거부되고 입력값이 남는다', async () => {
  await withServer(async (base, db) => {
    const r = await post(`${base}/problems`, { subject: 'Java', content: 'q', solution: 'KEEPME', result: '틀림', reason: '' });
    assert.equal(r.status, 400);
    const html = await r.text();
    assert.match(html, /틀린 이유를 입력해 주세요/);
    assert.match(html, /KEEPME/);
    assert.equal(await count(db, 'problems'), 0);

    await post(`${base}/problems`, { subject: 'Java', content: 'q', solution: 's', result: '맞음' });
    const r2 = await post(`${base}/problems/1/attempts`, { solution: 's2', result: '틀림' });
    assert.equal(r2.status, 400);
    assert.equal(await count(db, 'attempts'), 1);
  });
});

test('없는 문제는 404, 시도 수정·삭제 라우트는 없다', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/problems/99`)).status, 404);
    assert.equal((await fetch(`${base}/problems/abc`)).status, 404);
    assert.equal((await post(`${base}/problems/99/attempts`, { solution: 's', result: '맞음' })).status, 404);
    assert.equal((await fetch(`${base}/problems/1/attempts/1`, { method: 'DELETE' })).status, 404);
  });
});

test('integer 범위를 넘거나 0·음수인 id도 DB 오류 없이 404', async () => {
  await withServer(async (base) => {
    for (const id of ['99999999999', '0', '-1', '1.5']) {
      assert.equal((await fetch(`${base}/problems/${id}`)).status, 404, id);
    }
    assert.equal((await post(`${base}/problems/99999999999/attempts`, { solution: 's', result: '맞음' })).status, 404);
  });
});

test('요청 본문이 100kb를 넘으면 413으로 거부하고 저장하지 않는다', async () => {
  await withServer(async (base, db) => {
    const r = await post(`${base}/problems`, { subject: 'Java', content: 'q', solution: 'x'.repeat(200 * 1024), result: '맞음' });
    assert.equal(r.status, 413);
    assert.match(await r.text(), /너무 깁니다/);
    assert.equal(await count(db, 'problems'), 0);
    // 한도 안의 큰 입력은 저장된다
    const ok = await post(`${base}/problems`, { subject: 'Java', content: 'q', solution: 'x'.repeat(50 * 1024), result: '맞음' });
    assert.equal(ok.status, 303);
  });
});

test('DB 오류가 나면 내부 내용 없이 500', async () => {
  const db = await createTestDb();
  const broken = { ...db, query: async () => { throw new Error('secret-detail'); } };
  const server = createApp(broken).listen(0);
  const orig = console.error;
  console.error = () => {};
  try {
    const r = await fetch(`http://localhost:${server.address().port}/`);
    assert.equal(r.status, 500);
    assert.doesNotMatch(await r.text(), /secret-detail/);
  } finally {
    console.error = orig;
    server.close();
    await db.close();
  }
});
