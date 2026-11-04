-- 문제 풀이 노트 스키마 (Postgres). 여러 번 실행해도 안전하다(멱등).
-- 테스트(PGlite)와 실서버(Supabase)가 같은 파일을 쓴다.

CREATE TABLE IF NOT EXISTS problems (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject    text NOT NULL CHECK (subject IN ('Java', 'DB')),
  number     integer NOT NULL,
  content    text NOT NULL CHECK (btrim(content, E' \t\r\n') <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject, number)
);

CREATE TABLE IF NOT EXISTS attempts (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  problem_id integer NOT NULL REFERENCES problems(id),
  attempt_no integer NOT NULL,
  solution   text NOT NULL CHECK (btrim(solution, E' \t\r\n') <> ''),
  result     text NOT NULL CHECK (result IN ('맞음', '틀림')),
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_id, attempt_no),
  CHECK (result = '맞음' OR btrim(coalesce(reason, ''), E' \t\r\n') <> '')
);

-- 지난 시도는 수정·삭제할 수 없다. TRUNCATE는 행 트리거를 건너뛰므로 따로 막는다.
CREATE OR REPLACE FUNCTION attempts_block_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION '지난 시도는 수정할 수 없습니다';
  END IF;
  RAISE EXCEPTION '지난 시도는 삭제할 수 없습니다';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attempts_no_update_delete ON attempts;
CREATE TRIGGER attempts_no_update_delete
  BEFORE UPDATE OR DELETE ON attempts
  FOR EACH ROW EXECUTE FUNCTION attempts_block_change();

DROP TRIGGER IF EXISTS attempts_no_truncate ON attempts;
CREATE TRIGGER attempts_no_truncate
  BEFORE TRUNCATE ON attempts
  FOR EACH STATEMENT EXECUTE FUNCTION attempts_block_change();

-- Supabase는 public 스키마를 REST API로 공개한다. RLS를 켜고 정책을 만들지 않으면
-- anon/authenticated 키로는 접근할 수 없다. 서버는 DB 비밀번호로 직접 접속하므로 영향이 없다.
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
