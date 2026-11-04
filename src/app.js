const path = require('node:path');
const express = require('express');
const { validateProblem, validateAttempt } = require('./validate');
const { createProblem, addAttempt, getProblem, listProblems, getSummary } = require('./repo');
const { formatKst } = require('./format');

function createApp(db) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.formatKst = formatKst;
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/', (req, res) => {
    const onlyWrong = req.query.filter === 'wrong';
    res.render('index', {
      summary: getSummary(db),
      problems: listProblems(db, { onlyWrong }),
      onlyWrong,
    });
  });

  app.get('/problems/new', (req, res) => {
    res.render('new', { errors: [], values: { subject: 'Java', result: '맞음' } });
  });

  app.post('/problems', (req, res) => {
    const check = validateProblem(req.body);
    if (!check.ok) {
      return res.status(400).render('new', { errors: check.errors, values: req.body });
    }
    res.redirect(303, `/problems/${createProblem(db, check.value)}`);
  });

  app.get('/problems/:id', (req, res) => {
    const problem = getProblem(db, Number(req.params.id));
    if (!problem) return res.status(404).render('not-found');
    res.render('show', { problem, errors: [], values: { result: '맞음' } });
  });

  // 시도는 추가만 가능하다. 수정·삭제 라우트는 의도적으로 만들지 않는다.
  app.post('/problems/:id/attempts', (req, res) => {
    const id = Number(req.params.id);
    const problem = getProblem(db, id);
    if (!problem) return res.status(404).render('not-found');
    const check = validateAttempt(req.body);
    if (!check.ok) {
      return res.status(400).render('show', { problem, errors: check.errors, values: req.body });
    }
    addAttempt(db, id, check.value);
    res.redirect(303, `/problems/${id}`);
  });

  app.use((req, res) => res.status(404).render('not-found'));
  return app;
}

module.exports = { createApp };
