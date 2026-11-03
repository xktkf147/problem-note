# 문제 풀이 노트

Java·DB(SQL) 문제를 하나씩 기록하고, 풀이 시도(풀이·결과·틀린 이유)를 순서대로 쌓아 두는 1인용 풀이 노트입니다.

## 실행 방법

Node.js 22.13 이상 (24 권장)이 필요합니다. (`node:sqlite` 내장 사용)

```
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. 테스트는 `npm test`.

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

## 문서

- [PRD.md](PRD.md) — 무엇을 만드는지, 범위, 검증 기록
- [PLAN.md](PLAN.md) — 구현 계획
- [retrospective.md](retrospective.md) — 회고
