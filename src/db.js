const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const CA_PATH = path.join(__dirname, '..', 'certs', 'supabase-ca.crt');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');
const SCHEMA_NAME = /^[a-z_][a-z0-9_]*$/;

// Supabase CA 인증서로 서버 인증서를 검증한다. (rejectUnauthorized: false를 쓰지 않는다)
function sslOptions() {
  return { ca: fs.readFileSync(CA_PATH, 'utf8'), rejectUnauthorized: true };
}

function schemaSql() {
  return fs.readFileSync(SCHEMA_PATH, 'utf8');
}

// pg 연결 풀을 { query, exec, tx, close } 어댑터로 감싼다. 풀은 첫 쿼리 때 연결한다.
// schema를 주면 연결마다 search_path를 그 스키마로 맞춘다(임시 스키마로 시험할 때 사용).
function createPgDb(connectionString, { schema } = {}) {
  if (schema !== undefined && !SCHEMA_NAME.test(schema)) {
    throw new Error(`스키마 이름이 올바르지 않습니다: ${schema}`);
  }
  const pool = new Pool({ connectionString, max: 5, ssl: sslOptions() });
  if (schema) pool.on('connect', (client) => client.query(`SET search_path TO ${schema}`));

  return {
    query: (sql, params) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({ query: (sql, params) => client.query(sql, params) });
        await client.query('COMMIT');
        return out;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

module.exports = { createPgDb, sslOptions, schemaSql };
