const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAttempt, validateProblem } = require('../src/validate');

const okProblem = { subject: 'Java', content: '문제', solution: 'int a;', result: '맞음' };

test('정상 문제는 통과', () => {
  const r = validateProblem(okProblem);
  assert.equal(r.ok, true);
  assert.equal(r.value.reason, null);
});
test('과목이 Java/DB가 아니면 거부', () => {
  assert.equal(validateProblem({ ...okProblem, subject: 'Python' }).ok, false);
  assert.equal(validateProblem({ ...okProblem, subject: undefined }).ok, false);
});
test('문제 내용이 비거나 공백뿐이면 거부', () => {
  assert.equal(validateProblem({ ...okProblem, content: '' }).ok, false);
  assert.equal(validateProblem({ ...okProblem, content: ' \n\t ' }).ok, false);
});
test('풀이가 비어 있으면 거부', () => {
  assert.equal(validateAttempt({ solution: '  ', result: '맞음' }).ok, false);
});
test('틀림인데 이유가 없거나 공백이면 거부', () => {
  const noReason = validateAttempt({ solution: 'x', result: '틀림' });
  assert.equal(noReason.ok, false);
  assert.match(noReason.errors[0], /틀린 이유/);
  assert.equal(validateAttempt({ solution: 'x', result: '틀림', reason: '   ' }).ok, false);
});
test('틀림 + 이유가 있으면 통과', () => {
  const r = validateAttempt({ solution: 'x', result: '틀림', reason: ' 세미콜론 빠뜨림 ' });
  assert.equal(r.ok, true);
  assert.equal(r.value.reason, '세미콜론 빠뜨림');
});
test('맞음이면 이유는 저장하지 않음(null)', () => {
  const r = validateAttempt({ solution: 'x', result: '맞음', reason: '무시됨' });
  assert.equal(r.value.reason, null);
});
test('결과가 맞음/틀림이 아니면 거부', () => {
  assert.equal(validateAttempt({ solution: 'x', result: '통과' }).ok, false);
});
test('줄바꿈은 \n으로 통일하되 들여쓰기는 그대로', () => {
  const r = validateAttempt({ solution: 'if (a) {\r\n    b();\r\n}', result: '맞음' });
  assert.equal(r.value.solution, 'if (a) {\n    b();\n}');
});
test('오류가 여러 개면 모두 알려 줌', () => {
  const r = validateProblem({ subject: 'X', content: '', solution: '', result: '틀림' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 4);
});
