# 문제 풀이 노트 구현 계획

## Context
PRD.md의 MVP(1인용 풀이 노트)를 만든다. 핵심은 "문제 1개 = 페이지 1개, 그 아래에 시도 1, 2, 3…이 지워지지 않고 쌓이는 것". 작업 폴더(D:\dev\problem-note2)에는 PRD.md만 있고 기존 코드는 없다.

## 스택 (결정)
**Node.js + Express + SQLite(Node 내장 `node:sqlite`) + EJS(서버 렌더링)**, 프론트 빌드·프레임워크 없음.
- `node:sqlite`는 Node 내장이라 Windows에서 C++ 빌드 없이 설치된다(별도 SQLite 패키지 불필요). 사용 전 `node -v`로 지원 버전(22.5+, 안정적으로는 최신 LTS)인지 확인한다. API는 동기식 `DatabaseSync`, `db.prepare().run/get/all`, 트랜잭션은 `BEGIN/COMMIT/ROLLBACK`을 직접 실행.
- 근거: 화면이 목록/상세/폼 3종뿐이라 SPA·API 분리가 불필요하다. 서버 렌더링이면 파일이 적고 비전공자도 흐름을 따라가기 쉽다.
- SQLite는 파일 하나라 무료·설치 간단·서버 재시작 후에도 데이터가 남는다(완성 기준). 규칙을 DB 제약으로 걸 수 있다.
- 비밀값/설정(PORT, DB 경로)은 `.env`(dotenv), `.env.example`만 커밋. `.gitignore`에 `.env`, `*.db`.

## 데이터 모델 (문제 1 : 시도 N)
```
problems
  id INTEGER PK
  subject TEXT NOT NULL CHECK (subject IN ('Java','DB'))
  number  INTEGER NOT NULL            -- 과목별 번호 (Java #12)
  content TEXT NOT NULL CHECK (length(trim(content)) > 0)
  created_at TEXT NOT NULL            -- UTC ISO
  UNIQUE (subject, number)

attempts
  id INTEGER PK
  problem_id INTEGER NOT NULL REFERENCES problems(id)
  attempt_no INTEGER NOT NULL         -- 시도 1,2,3…
  solution TEXT NOT NULL CHECK (length(trim(solution)) > 0)
  result TEXT NOT NULL CHECK (result IN ('맞음','틀림'))
  reason TEXT                         -- 틀림일 때만 필수
  created_at TEXT NOT NULL            -- UTC ISO
  UNIQUE (problem_id, attempt_no)
  CHECK (result = '맞음' OR length(trim(coalesce(reason,''))) > 0)
```
- **외래키 활성화**: SQLite는 기본이 꺼져 있으므로 연결을 열 때마다 `PRAGMA foreign_keys = ON;`을 실행한다(`src/db.js`의 연결 생성 직후, 스키마 생성보다 먼저). 테스트에서 존재하지 않는 `problem_id`로 시도를 넣으면 실패하는지 확인한다.
- 문제 생성 + 시도 1 저장은 **한 트랜잭션**. `number`는 같은 트랜잭션에서 `MAX(number)+1`(과목별), `attempt_no`도 `MAX+1`(문제별).

## 규칙을 지키는 위치 (이중 방어)
| 규칙 | 1차: 서버(Express 핸들러, 사용자 메시지) | 2차: DB(우회 불가) |
|---|---|---|
| 과목은 Java/DB만 | 허용 목록 검사 | `CHECK subject IN` |
| 내용·풀이 비면 저장 안 함 | trim 후 빈 값 거부, 폼 재표시 | `CHECK length(trim())>0` |
| 틀림이면 이유 필수 | result='틀림' & reason 빈 값 거부, 입력값 유지한 채 오류 표시 | attempts의 CHECK |
| 지난 시도 덮어쓰기·삭제 금지 | attempts에 **UPDATE/DELETE 라우트 자체를 만들지 않음**(추가만 `POST /problems/:id/attempts`) | `BEFORE UPDATE`/`BEFORE DELETE` 트리거가 `RAISE(ABORT)` |

## 문제 상태 (저장하지 않고 매번 계산)
상태 컬럼을 두면 시도와 어긋날 수 있으므로 시도 기록에서 파생한다.
- 틀린 적이 한 번도 없음 → **맞음**
- 마지막 시도 틀림 → **틀림**
- 틀린 적 있고 마지막 시도 맞음 → **해결**
- 구현: `src/status.js`의 순수 함수 `deriveStatus(results[])` 하나를 목록·상세가 공유. 목록 조회는 시도 횟수·틀림 횟수·마지막 결과를 SQL 서브쿼리로 가져와 같은 함수에 넣는다. "틀린 문제만 보기" = `?filter=wrong` → 상태가 '틀림'인 것만(마지막 시도 result='틀림').

## 줄바꿈·들여쓰기 보존
- 저장: 입력 그대로 저장(내부 공백·탭 보존). `\r\n`→`\n`만 정규화, 앞뒤 빈 줄 외 가공 없음.
- 표시: EJS의 이스케이프 출력(`<%= %>`)을 `<pre><code>` 안에 사용 → XSS 방지 + 공백 보존. CSS `white-space: pre; overflow-x: auto; font-family: monospace`.
- 입력 textarea에도 monospace 적용, 오류로 폼 재표시할 때 값을 그대로 되돌려 준다. 문제 본문도 `white-space: pre-wrap`.

## "오늘"을 한국 시간으로 세기
- `created_at`은 UTC ISO로 저장(서버 TZ와 무관).
- 집계는 SQLite에서 `date(created_at, '+9 hours') = date('now', '+9 hours')`. 한국은 DST가 없어 +9h 고정이 안전.
- 정의: **오늘 푼 문제 수 = 오늘(KST) 시도가 1개 이상 있는 서로 다른 문제 수**(다시 푼 문제도 오늘 푼 것으로 셈). 과목별 푼 문제 수 = 과목별 문제 수(`GROUP BY subject`).
- 상세 페이지의 시각 표시도 KST로 변환(`Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul'})`).

## 화면/라우트
- `GET /` 목록: 상단 요약(Java n · DB n · 오늘 n), "틀린 문제만 보기" 토글, 최신순 목록(`Java #12`, 상태 뱃지, 시도 횟수), 새 문제 폼 링크.
- `GET /problems/new`, `POST /problems` — 과목·문제·첫 풀이·결과(·이유).
- `GET /problems/:id` 상세 — 문제 + 시도 1..N 순서대로 + "다시 풀기" 폼.
- `POST /problems/:id/attempts` — 시도 추가.
- 없는 id는 404.

## 파일 구조
```
package.json  .env.example  .gitignore
src/server.js        # Express 앱, 라우트
src/db.js            # 연결, 스키마/트리거 생성(최초 실행 시)
src/status.js        # deriveStatus
src/validate.js      # 입력 검증
views/{layout,index,new,show}.ejs
public/style.css
test/                # node:test — status, validate, 시나리오
```

## 구현 순서
0. 이 계획을 `PLAN.md`로 저장하고, `git init` 후 `PRD.md`·`PLAN.md`를 "PRD와 계획"으로 커밋
1. 스캐폴드(`npm init`, express/ejs/dotenv) + DB 스키마·트리거·`PRAGMA foreign_keys = ON`
2. status/validate 순수 함수 + 단위 테스트
3. 문제 추가 → 상세 → 시도 추가 라우트/화면
4. 목록(요약·필터·상태·시도 횟수)
5. 스타일, PRD 검증 기록 갱신

**커밋 규칙**: 1~5 각 단계가 끝나 동작을 확인(테스트 통과 또는 브라우저 확인)할 때마다 커밋한다. 확인 전에는 커밋하지 않고, 커밋 메시지에 확인한 내용을 짧게 적는다.

## 검증 (PRD 최소 성공 조건과 1:1)
- 자동: `node --test` — ⓪ 없는 `problem_id`로 시도 삽입 시 외래키 오류 ① `deriveStatus`(맞음/틀림/해결 케이스) ② 틀림+이유 없음 거부 ③ DB에서 attempts UPDATE/DELETE가 트리거로 실패 ④ KST 자정 경계(UTC 14:59 vs 15:00)로 "오늘" 집계.
- 수동(서버 실행 후 브라우저): 
  1. 들여쓰기 있는 Java 코드로 문제 기록 → 목록·상세 확인, 서버 재시작 후에도 유지.
  2. 같은 문제에 틀림(이유 없이 → 거부) → 틀림 → 틀림 → 맞음: 시도 1~3 순서·이유 표시, 상태 '해결'.
  3. Java/DB 문제를 섞어 기록 → 과목별·오늘 개수, "틀린 문제만 보기"에 '틀림'만 나오는지.
- 확인한 내용은 PRD의 "검증 기록" 표(미확인 → 결과/실제로 본 것)에 채운다.

## 열린 가정 (필요하면 바꿀 수 있음)
- "오늘 푼 문제 수"는 오늘 시도가 있는 문제 수로 정의(위).
- 문제 수정·삭제 기능은 PRD에 없어 만들지 않음.

---

# 6단계: Supabase 전환

브랜치 `supabase`에서만 진행한다. `main`은 Render에 배포 중이므로 건드리지 않는다.

## 목적
Render 무료 Web Service는 재시작 때 로컬 파일이 사라져 SQLite 기록이 초기화된다. 저장소를 Supabase(Postgres)로 바꿔 배포 사이트에서도 기록이 남게 한다. PRD 규칙과 화면 동작은 그대로 두는 **저장소 교체**이며 기능 추가는 없다.

## 큰 결정
| 항목 | 결정 | 근거 |
|---|---|---|
| 접속 방식 | `pg`(node-postgres)로 Postgres에 직접 SQL 접속 (`DATABASE_URL`) | 문제+시도를 한 트랜잭션으로 묶고 락·트리거·제약을 그대로 쓰려면 SQL 접속이 필요 |
| supabase-js(REST) | 쓰지 않음 | 여러 문장 트랜잭션·락이 안 되고, 서버에서 쓰려면 `service_role` 키가 필요 |
| 접속 주소 | Session pooler 문자열(포트 5432) | Render 무료는 IPv4만 되는데 직접 접속 주소는 IPv6 전용 |
| 스키마 적용 | `db/schema.sql`(멱등) + `npm run migrate` | 테스트와 실서버가 같은 SQL을 쓴다. 서버 시작 때는 DB를 건드리지 않는다 |
| 코드 | `repo.js`·`app.js`를 `async/await`로 | `pg`는 비동기. Express 5가 async 핸들러 오류를 자동 처리 |
| 의존성 | `pg` 추가, `node:sqlite` 제거, 개발용 `@electric-sql/pglite` 추가 | PGlite는 테스트용 |

## PRD 규칙을 Postgres에서 지키는 방법
- 과목: `CHECK (subject IN ('Java','DB'))`
- 빈 값 거부: `CHECK (btrim(content, E' \t\r\n') <> '')` (풀이도 동일). SQLite의 `trim()`은 공백만 지웠지만 여기서는 탭·줄바꿈까지 빈 값으로 본다.
- 틀림이면 이유 필수: `CHECK (result = '맞음' OR btrim(coalesce(reason,''), E' \t\r\n') <> '')`
- 지난 시도 수정·삭제 금지: `attempts`의 `BEFORE UPDATE OR DELETE` 행 트리거 + `BEFORE TRUNCATE` 문장 트리거(TRUNCATE는 행 트리거를 건너뛰므로)
- 외래키는 Postgres에서 항상 켜져 있다(`PRAGMA` 불필요).
- "오늘(KST)": `(created_at AT TIME ZONE 'Asia/Seoul')::date`로 비교. `timestamptz DEFAULT now()`로 저장.
- 공개 REST API 차단: 두 테이블에 `ENABLE ROW LEVEL SECURITY`(정책 없음). 서버는 DB 비밀번호로 직접 접속하므로 영향 없다.
- id는 `integer`로 둔다(pg가 bigint를 문자열로 돌려주므로). COUNT도 `::int`.

## 문제 + 첫 시도 저장과 과목별 번호
- 한 트랜잭션: `pg_advisory_xact_lock(hashtext(subject))`로 같은 과목의 동시 저장을 줄 세운 뒤 `MAX(number)+1` → 문제 INSERT → 시도 1 INSERT. 하나라도 실패하면 전부 롤백.
- 시도 추가: `SELECT ... FROM problems WHERE id = $1 FOR UPDATE`로 그 문제를 잠근 뒤 `MAX(attempt_no)+1`. 문제가 없으면 `null`(404).
- 안전망: 기존 `UNIQUE (subject, number)`, `UNIQUE (problem_id, attempt_no)`.

## 테스트 (실제 Supabase를 건드리지 않음)
- 테스트 DB는 PGlite(WASM Postgres). 트리거·제약·락·`AT TIME ZONE`이 실제 Postgres와 같다.
- `{ query(sql, params), tx(fn) }` 어댑터 하나를 `pg`(실서버)와 PGlite(테스트)가 같은 모양으로 구현한다.
- 테스트는 `dotenv`를 읽지 않고 `DATABASE_URL`을 쓰지 않는다. `npm test`는 `DATABASE_URL`을 비운 채 실행한다.
- 기존 37개는 `await`를 붙이는 방식으로 포팅하고, DB 규칙 테스트(FK, CHECK, UPDATE/DELETE/TRUNCATE 거부, 롤백)를 추가한다.
- 한계: PGlite는 연결이 하나라 동시 요청 경합은 자동 테스트로 재현하지 못한다. 락은 실DB 수동 확인으로 본다.

## 로그인 없이 쓰는 위험 (이번엔 미룸)
공개 URL 하나로 누구나 읽고 쓰는 영구 DB가 된다.
- 내용 노출: 배포 주소를 공개하지 않고 민감한 내용을 기록하지 않는다.
- 스팸·장난 기록: 지난 시도는 트리거 때문에 지울 수 없으므로 정리가 어렵다(SQL 에디터에서 트리거를 끄거나 스키마를 지워야 함). 정리 방법을 README에 적는다.
- 용량·정지: 무료 DB는 500MB 한도, 1주일 접속이 없으면 일시정지. 요청 본문 크기를 100kb로 제한한다.
- Supabase 자체 REST API: RLS 활성화로 해결.
- CSRF·속도 제한: 다음 단계(로그인과 함께). 다음 단계에서는 사용자별 `user_id` 컬럼과 RLS 정책을 둔다.

## 비밀 키와 SSL
- `service_role`·`anon` 키는 쓰지 않는다. `service_role`은 RLS를 우회하는 관리자 키라 유출 시 DB 전체가 열린다.
- 비밀값은 DB 비밀번호가 든 `DATABASE_URL` 하나. 로컬은 `.env`(git 제외), 저장소에는 값 없는 `.env.example`, Render는 Environment 변수로 관리한다.
- SSL은 `rejectUnauthorized: false` 대신 Supabase CA 인증서(`certs/supabase-ca.crt`)로 검증한다. 풀러 주소로 검증이 실패하면 그 이유와 위험을 README에 남기고 `sslOptions()` 한 곳만 바꾼다. `DATABASE_URL`에는 `?sslmode=`를 붙이지 않는다.

## 구현 순서 (단계마다 확인 후 커밋)
0. 브랜치 `supabase` 생성, 이 섹션 추가
1. (사용자) Supabase 프로젝트 생성, `.env`에 `DATABASE_URL`, CA 인증서를 `certs/supabase-ca.crt`로 저장
2. `db/schema.sql` + `scripts/migrate.js` + PGlite 테스트 헬퍼 + 스키마 규칙 테스트
3. `src/db.js` 어댑터, `repo.js`·`app.js` 비동기 전환(락 포함), 기존 테스트 포팅
4. `server.js`(DATABASE_URL 검사), `.env.example`, `package.json`(pg, `migrate`), 본문 크기 제한
5. 실 Supabase 확인: 임시 스키마 `smoke`로 migrate와 수동 확인 → `DROP SCHEMA smoke CASCADE` → `public`에 migrate
6. README(배포 섹션, 정리 방법, SSL 방식)

## 배포 전환 순서
`supabase` 브랜치 확인 → Render에 `DATABASE_URL` 등록 → Build Command를 `npm install && npm run migrate`로 변경 → 사용자가 main에 병합. 순서가 바뀌면 병합 직후 배포가 실패한다.

## 열린 가정
- 기존 로컬 `data/notes.db` 기록은 옮기지 않는다(원하면 가져오기 스크립트 추가).
- 목록·상태 계산은 JS(`deriveStatus`)를 그대로 쓴다.
