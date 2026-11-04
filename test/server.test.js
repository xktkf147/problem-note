const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SERVER = path.join(__dirname, '..', 'src', 'server.js');
// 실제 DATABASE_URL(.env)을 쓰지 않도록 항상 값을 직접 지정한다(dotenv는 이미 있는 값을 덮어쓰지 않음).
const DUMMY_URL = 'postgres://x:x@127.0.0.1:1/x';

test('포트가 이미 사용 중이면 오류 메시지를 보여 주고 종료 코드 1로 끝난다', async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, resolve));
  const port = blocker.address().port;
  try {
    const r = spawnSync(process.execPath, [SERVER], {
      env: { ...process.env, PORT: String(port), DATABASE_URL: DUMMY_URL },
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

test('DATABASE_URL이 없으면 이유를 보여 주고 종료 코드 1로 끝난다', () => {
  const r = spawnSync(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', DATABASE_URL: '' },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /DATABASE_URL이 설정되어 있지 않습니다/);
});
