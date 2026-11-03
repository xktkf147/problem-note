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
- 첫 시도 맞음 → **맞음**
- 마지막 시도 틀림 → **틀림**
- 틀린 적 있고 마지막 시도 맞음 → **해결**
- 구현: `src/status.js`의 순수 함수 `deriveStatus(results[])` 하나를 목록·상세가 공유. 목록 조회는 시도 횟수·첫/마지막 결과를 SQL 서브쿼리로 가져와 같은 함수에 넣는다. "틀린 문제만 보기" = `?filter=wrong` → 상태가 '틀림'인 것만(마지막 시도 result='틀림').

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
