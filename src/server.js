require('dotenv').config({ quiet: true });
const { createPgDb } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

function fail(message, err) {
  console.error(`서버를 시작하지 못했습니다: ${message}`);
  if (err) console.error(err);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL이 설정되어 있지 않습니다. .env 또는 Render 환경 변수를 확인하세요.');
}

let db;
try {
  // 풀은 첫 요청 때 연결하므로 서버를 띄우는 데는 DB 접속이 필요 없다.
  db = createPgDb(process.env.DATABASE_URL, { schema: process.env.DATABASE_SCHEMA || undefined });
} catch (err) {
  fail('DB 설정이 올바르지 않습니다.', err);
}

// Express 5는 listen 실패(포트 사용 중 등)를 콜백의 첫 인자로 넘긴다.
// 이를 무시하면 성공 메시지만 찍고 조용히 종료되므로 반드시 확인한다.
createApp(db).listen(PORT, (err) => {
  if (err) {
    const hint =
      err.code === 'EADDRINUSE'
        ? `포트 ${PORT}를 다른 프로그램이 이미 사용 중입니다. .env의 PORT를 바꾸거나 그 프로그램을 끄세요.`
        : err.code === 'EACCES'
          ? `포트 ${PORT}를 사용할 권한이 없습니다. .env의 PORT를 바꿔 보세요.`
          : err.message;
    return fail(`${hint} (${err.code || 'unknown'})`);
  }
  console.log(`http://localhost:${PORT}`);
});
