// db/schema.sql을 DATABASE_URL의 DB에 적용한다. 멱등이라 여러 번 실행해도 된다.
// DATABASE_SCHEMA를 주면(예: smoke) 그 스키마에 만든다. 시험이 끝나면 DROP SCHEMA ... CASCADE로 지운다.
require('dotenv').config({ quiet: true });
const { createPgDb, schemaSql } = require('../src/db');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL이 설정되어 있지 않습니다. .env 또는 환경 변수를 확인하세요.');
  const schema = process.env.DATABASE_SCHEMA || undefined;

  const db = createPgDb(url, { schema });
  try {
    if (schema) await db.exec(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await db.exec(schemaSql());
    console.log(`스키마 적용 완료${schema ? ` (스키마: ${schema})` : ''}`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(`마이그레이션 실패: ${err.message}`);
  process.exit(1);
});
