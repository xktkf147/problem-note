const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('포트가 이미 사용 중이면 오류 메시지를 보여 주고 종료 코드 1로 끝난다', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, resolve));
  const port = blocker.address().port;
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], {
      env: { ...process.env, PORT: String(port), DB_PATH: ':memory:' },
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /서버를 시작하지 못했습니다/);
    assert.match(r.stderr, /EADDRINUSE/);
    assert.doesNotMatch(r.stdout, /http:\/\/localhost/);
  } finally {
    blocker.close();
  }
});
