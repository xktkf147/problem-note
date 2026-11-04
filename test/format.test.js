const test = require('node:test');
const assert = require('node:assert/strict');
const { firstLine } = require('../src/format');
const { openDb } = require('../src/db');
const { createProblem } = require('../src/repo');
const { createApp } = require('../src/app');

test('firstLine: 여러 줄이면 첫 줄만', () => {
  assert.equal(firstLine('학점 계산하기\n점수가 85점일 때'), '학점 계산하기');
});
test('firstLine: 앞쪽 빈 줄과 공백은 건너뜀', () => {
  assert.equal(firstLine('\n  \n   member 조회  \n둘째 줄'), 'member 조회');
});
test('firstLine: 길면 max자로 자르고 … 표시', () => {
  assert.equal(firstLine('가'.repeat(50), 40), '가'.repeat(40) + '…');
});
test('firstLine: max자 이하면 그대로, 빈 내용은 빈 문자열', () => {
  assert.equal(firstLine('가'.repeat(40), 40), '가'.repeat(40));
  assert.equal(firstLine(''), '');
});
test('firstLine: 이모지 같은 두 칸짜리 글자를 반으로 자르지 않음', () => {
  assert.equal(firstLine('😀😀😀😀', 2), '😀😀…');
});
test('firstLine: CRLF 줄바꿈도 처리', () => {
  assert.equal(firstLine('첫줄\r\n둘째'), '첫줄');
});

test('홈 목록에 문제 첫 줄이 보이고 긴 문제는 …로 잘리며 HTML은 이스케이프된다', async () => {
  const db = openDb(':memory:');
  const base = { subject: 'Java', solution: 's', result: '맞음', reason: null };
  createProblem(db, { ...base, content: '학점 계산하기\n둘째 줄은 안 보임' });
  createProblem(db, { ...base, content: '긴문제'.repeat(30) });
  createProblem(db, { ...base, content: '<script>x</script>' });
  const server = createApp(db).listen(0);
  try {
    const html = await (await fetch(`http://localhost:${server.address().port}/`)).text();
    assert.ok(html.includes('<div class="title">학점 계산하기</div>'));
    assert.ok(!html.includes('둘째 줄은 안 보임'));
    assert.ok(html.includes('<div class="title">' + '긴문제'.repeat(30).slice(0, 40) + '…</div>'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
  } finally {
    server.close();
  }
});
