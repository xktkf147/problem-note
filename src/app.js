const path = require('node:path');
const express = require('express');
const { validateProblem, validateAttempt } = require('./validate');
const { createProblem, addAttempt, getProblem, listProblems, getSummary } = require('./repo');
const { formatKst, firstLine } = require('./format');

const MAX_ID = 2147483647; // Postgres integer 최대값

// 숫자가 아니거나 integer 범위를 벗어난 id는 DB에 보내지 않고 없는 문제로 취급한다.
function parseId(raw) {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 && id <= MAX_ID ? id : null;
}

function createApp(db) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.formatKst = formatKst;
  app.locals.firstLine = firstLine;
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Express 5는 async 핸들러가 던진 오류를 맨 아래 오류 처리기로 넘긴다.
  app.get('/', async (req, res) => {
    const onlyWrong = req.query.filter === 'wrong';
    res.render('index', {
      summary: await getSummary(db),
      problems: await listProblems(db, { onlyWrong }),
      onlyWrong,
    });
  });

  app.get('/problems/new', (req, res) => {
    res.render('new', { errors: [], values: { subject: 'Java', result: '맞음' } });
  });

  app.post('/problems', async (req, res) => {
    const check = validateProblem(req.body);
    if (!check.ok) {
      return res.status(400).render('new', { errors: check.errors, values: req.body });
    }
    res.redirect(303, `/problems/${await createProblem(db, check.value)}`);
  });

  app.get('/problems/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const problem = id && (await getProblem(db, id));
    if (!problem) return res.status(404).render('not-found');
    res.render('show', { problem, errors: [], values: { result: '맞음' } });
  });

  // 시도는 추가만 가능하다. 수정·삭제 라우트는 의도적으로 만들지 않는다.
  app.post('/problems/:id/attempts', async (req, res) => {
    const id = parseId(req.params.id);
    const problem = id && (await getProblem(db, id));
    if (!problem) return res.status(404).render('not-found');
    const check = validateAttempt(req.body);
    if (!check.ok) {
      return res.status(400).render('show', { problem, errors: check.errors, values: req.body });
    }
    await addAttempt(db, id, check.value);
    res.redirect(303, `/problems/${id}`);
  });

  app.use((req, res) => res.status(404).render('not-found'));

  // 내부 오류는 서버 로그에만 자세히 남기고, 화면에는 내용을 드러내지 않는다.
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).type('text/plain; charset=utf-8').send('서버 오류가 발생했습니다.');
  });
  return app;
}

module.exports = { createApp };
