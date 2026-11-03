const test = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

async function withServer(fn) {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base, db);
  } finally {
    server.close();
  }
}

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
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM problems').get().n, 0);

    await post(`${base}/problems`, { subject: 'Java', content: 'q', solution: 's', result: '맞음' });
    const r2 = await post(`${base}/problems/1/attempts`, { solution: 's2', result: '틀림' });
    assert.equal(r2.status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM attempts').get().n, 1);
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
