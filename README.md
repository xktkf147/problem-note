# 문제 풀이 노트

Java·DB(SQL) 문제를 하나씩 기록하고, 풀이 시도(풀이·결과·틀린 이유)를 순서대로 쌓아 두는 1인용 풀이 노트입니다.

## 문서

- [PRD.md](PRD.md) — 무엇을 만드는지, 범위, 검증 기록
- [PLAN.md](PLAN.md) — 구현 계획
- [retrospective.md](retrospective.md) — 회고

## 실행 방법

Node.js 22.13 이상 (24 권장)이 필요합니다. 기록은 Supabase(Postgres)에 저장되므로 Supabase 프로젝트가 하나 필요합니다.

1. Supabase 프로젝트를 만들고, 대시보드 **Connect**에서 **Session pooler** 연결 문자열(포트 5432)을 복사합니다.
2. 프로젝트 설정 > Database > SSL Configuration에서 받은 CA 인증서가 `certs/supabase-ca.crt`로 저장돼 있어야 합니다. (저장소에 들어 있습니다)
3. 아래를 실행합니다.

```
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
# .env를 열어 DATABASE_URL에 1번에서 복사한 연결 문자열을 넣는다 (?sslmode= 는 붙이지 않는다)
npm run migrate             # 테이블·규칙을 만든다. 여러 번 실행해도 안전하다
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. 테스트는 `npm test`입니다. 테스트는 Supabase에 접속하지 않고 메모리 안의 Postgres(PGlite)로 돌아갑니다.

`.env`에는 DB 비밀번호가 들어 있으므로 절대 커밋하거나 공유하지 마세요. (`.gitignore`에 들어 있습니다)

## 확인 화면

![확인 화면 1](screenshots/01-%ED%8B%80%EB%A6%B0%EC%9D%B4%EC%9C%A0-%EC%97%86%EC%9D%B4-%EA%B1%B0%EB%B6%80.png)

틀린 이유 없이 '틀림'을 저장하면 "틀린 이유를 입력해 주세요." 오류가 나고, 입력한 값은 그대로 남는다.

![확인 화면 2](screenshots/02-%EC%8B%9C%EB%8F%841-%ED%8B%80%EB%A6%BC.png)

문제 하나만 있는 상세 페이지(Java #1). 시도 1이 '틀림'과 틀린 이유로 기록되고 코드 들여쓰기가 유지된다.

![확인 화면 3](screenshots/03-%EC%8B%9C%EB%8F%842-3.png)

다시 풀면 시도 2(틀림, 이유 표시)와 시도 3(맞음)이 순서대로 아래에 쌓인다.

![확인 화면 4](screenshots/04-%ED%95%B4%EA%B2%B0-%EC%83%81%ED%83%9C.png)

틀린 적이 있고 마지막 시도가 맞음이라 문제 상태가 '해결'로 바뀐다.

![확인 화면 5](screenshots/05-%EC%9E%AC%EC%8B%9C%EC%9E%91-%ED%84%B0%EB%AF%B8%EB%84%90.png)

서버를 끄고 터미널에서 `npm start`로 다시 실행한다.

![확인 화면 6](screenshots/06-%EC%9E%AC%EC%8B%9C%EC%9E%91-%ED%9B%84-%EC%9C%A0%EC%A7%80.png)

서버를 다시 켠 뒤에도 /problems/1의 문제와 시도 기록이 그대로 남아 있다.

![확인 화면 7](screenshots/07-DB1-%EA%B3%BC%EB%AA%A9%EB%B3%84-%EB%B2%88%ED%98%B8.png)

DB 과목 문제는 Java와 별도로 DB #1부터 번호가 붙고, SQL 줄바꿈·들여쓰기도 유지된다.

![확인 화면 8](screenshots/08-%EB%AA%A9%EB%A1%9D-%ED%99%94%EB%A9%B4.png)

목록 화면: 위쪽에 Java·DB 푼 문제 수와 오늘 푼 문제 수, 아래에 최신순 목록(상태 뱃지·시도 횟수)이 보인다.

![확인 화면 9](screenshots/09-%ED%8B%80%EB%A6%B0-%EB%AC%B8%EC%A0%9C%EB%A7%8C-%EB%B3%B4%EA%B8%B0.png)

"틀린 문제만 보기"를 누르면 상태가 '틀림'인 문제(DB #2, Java #2)만 보이고, "전체 보기"로 돌아갈 수 있다.

![확인 화면 10](screenshots/10-%EB%AA%A9%EB%A1%9D-%EC%B2%AB%EC%A4%84-%ED%91%9C%EC%8B%9C.png)

목록에 문제 내용의 첫 줄이 함께 보이고, 긴 문제(DB #3)는 "…"로 잘린다.

![확인 화면 11](screenshots/11-Render-%EC%9E%AC%EC%8B%9C%EC%9E%91-%EC%9D%B4%EB%B2%A4%ED%8A%B8.png)

Render 재시작 이벤트(Service restarted by you, 3:53 PM).

![확인 화면 12](screenshots/12-%EC%9E%AC%EC%8B%9C%EC%9E%91-%ED%9B%84-%EA%B8%B0%EB%A1%9D-%EC%9C%A0%EC%A7%80.png)

재시작 뒤에도 15:51에 기록한 DB #1이 Supabase에 그대로 남아 있다.

## 배포 (Render + Supabase)

기록은 Supabase에 저장되므로, Render 무료 Web Service가 재시작되거나 다시 배포돼도 기록이 남습니다.

| Render 설정 | 값 |
|---|---|
| Build Command | `npm install && npm run migrate` |
| Start Command | `npm start` |
| Environment | `DATABASE_URL` = Supabase Session pooler 연결 문자열 (`?sslmode=`는 붙이지 않음) |

- `PORT`는 Render가 알아서 넣어 줍니다. `.env`는 올리지 않으므로 `DATABASE_URL`은 Render 대시보드의 **Environment**에만 등록합니다.
- 순서: ① `DATABASE_URL`을 먼저 등록 → ② Build Command 변경 → ③ 배포. `DATABASE_URL`이 없으면 서버가 이유를 출력하고 시작하지 않습니다.
- `npm run migrate`는 테이블이 없을 때만 만들고, 이미 있으면 그대로 둡니다. 배포할 때마다 실행돼도 기록은 지워지지 않습니다.
- Supabase 무료 프로젝트는 1주일 동안 접속이 없으면 일시정지됩니다(대시보드에서 다시 켤 수 있음). DB 용량은 500MB입니다.

### SSL 인증서 검증
DB 접속은 SSL이며, `rejectUnauthorized: false`로 검증을 끄지 않고 Supabase CA 인증서(`certs/supabase-ca.crt`)로 서버 인증서를 검증합니다. 이 인증서는 공개 인증서라 저장소에 들어 있어도 안전합니다. 인증서 없이 접속하면 `SELF_SIGNED_CERT_IN_CHAIN`으로 거부되는 것을 확인했습니다.

### 로그인이 없다는 점 (알려진 위험)
이 앱에는 로그인이 없습니다. **배포 주소를 아는 사람은 누구나 모든 기록을 읽고 새 기록을 추가할 수 있습니다.**
- 주소를 공개하지 말고(이 README에도 적지 않았습니다), 민감한 내용은 기록하지 마세요.
- 누군가 스팸 기록을 넣어도 지난 시도는 규칙상 지울 수 없어서 정리가 번거롭습니다(아래 참고). 한 번에 보낼 수 있는 입력은 100kb로 제한해 두었습니다.
- Supabase 자체의 공개 REST API는 두 테이블에 RLS를 켜고 정책을 만들지 않아 막아 두었습니다. 서버는 DB 비밀번호로 직접 접속합니다.
- 다음 단계에서 로그인(사용자별 기록)을 추가할 계획입니다.

### 기록 정리하기
지난 시도는 DB 트리거가 수정·삭제를 막기 때문에 앱에서는 지울 수 없습니다. 꼭 지워야 하면 Supabase **SQL Editor**에서 트리거를 잠시 끄고 지웁니다. 아래처럼 `BEGIN`~`COMMIT`으로 감싸야 트리거가 꺼진 채로 남지 않습니다. **지운 기록은 되돌릴 수 없으니 실행 전에 확인하세요.**

문제 하나(예: `Java #2`)와 그 시도를 지우기:
```sql
BEGIN;
ALTER TABLE attempts DISABLE TRIGGER USER;
DELETE FROM attempts WHERE problem_id = (SELECT id FROM problems WHERE subject = 'Java' AND number = 2);
DELETE FROM problems WHERE subject = 'Java' AND number = 2;
ALTER TABLE attempts ENABLE TRIGGER USER;
COMMIT;
```
과목별 번호는 현재 가장 큰 번호 + 1로 붙으므로, 중간 문제를 지우면 그 번호는 비고 마지막 문제를 지우면 번호가 다시 쓰입니다.

전체 초기화(모든 문제·시도 삭제, 번호도 1부터 다시):
```sql
BEGIN;
ALTER TABLE attempts DISABLE TRIGGER USER;
TRUNCATE attempts, problems RESTART IDENTITY;
ALTER TABLE attempts ENABLE TRIGGER USER;
COMMIT;
```
