// 테스트용 DB: PGlite(프로세스 안에서 도는 진짜 Postgres)에 db/schema.sql을 적용한다.
// 실제 Supabase에는 절대 접속하지 않는다.
delete process.env.DATABASE_URL;

const { schemaSql } = require('../../src/db');

async function createTestDb() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  await pg.exec(schemaSql());
  return {
    query: (sql, params) => pg.query(sql, params),
    exec: (sql) => pg.exec(sql),
    tx: (fn) => pg.transaction((t) => fn({ query: (sql, params) => t.query(sql, params) })),
    close: () => pg.close(),
  };
}

module.exports = { createTestDb };
