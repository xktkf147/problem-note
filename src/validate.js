const SUBJECTS = ['Java', 'DB'];
const RESULTS = ['맞음', '틀림'];

// 줄바꿈만 \n으로 통일하고 들여쓰기·내부 공백은 그대로 둔다.
function normalize(text) {
  return typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
}

const isBlank = (text) => text.trim() === '';

// 시도(풀이·결과·틀린 이유) 검증. 통과하면 저장할 값, 아니면 오류 메시지 목록을 돌려준다.
function validateAttempt(input = {}) {
  const errors = [];
  const solution = normalize(input.solution);
  const result = input.result;
  const reason = normalize(input.reason).trim();

  if (isBlank(solution)) errors.push('풀이를 입력해 주세요.');
  if (!RESULTS.includes(result)) errors.push('결과는 맞음 또는 틀림이어야 합니다.');
  else if (result === '틀림' && reason === '') errors.push('틀린 이유를 입력해 주세요.');

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { solution, result, reason: result === '틀림' ? reason : null } };
}

// 새 문제 + 첫 시도 검증.
function validateProblem(input = {}) {
  const errors = [];
  const content = normalize(input.content);
  if (!SUBJECTS.includes(input.subject)) errors.push('과목은 Java 또는 DB만 선택할 수 있습니다.');
  if (isBlank(content)) errors.push('문제 내용을 입력해 주세요.');

  const attempt = validateAttempt(input);
  if (!attempt.ok) errors.push(...attempt.errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { subject: input.subject, content, ...attempt.value } };
}

module.exports = { SUBJECTS, RESULTS, validateAttempt, validateProblem };
