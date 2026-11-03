require('dotenv').config();
const { openDb } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || './data/notes.db';

function fail(message, err) {
  console.error(`서버를 시작하지 못했습니다: ${message}`);
  if (err) console.error(err);
  process.exit(1);
}

let db;
try {
  db = openDb(DB_PATH);
} catch (err) {
  fail(`DB를 열 수 없습니다 (${DB_PATH})`, err);
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
