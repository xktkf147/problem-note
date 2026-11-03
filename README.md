# 문제 풀이 노트

Java·DB(SQL) 문제를 하나씩 기록하고, 풀이 시도(풀이·결과·틀린 이유)를 순서대로 쌓아 두는 1인용 풀이 노트입니다.

## 실행 방법

Node.js 22.5 이상이 필요합니다. (`node:sqlite` 내장 사용)

```
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. 테스트는 `npm test`.

## 문서

- [PRD.md](PRD.md) — 무엇을 만드는지, 범위, 검증 기록
- [PLAN.md](PLAN.md) — 구현 계획
