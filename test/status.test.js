const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveStatus } = require('../src/status');

test('맞음 한 번 -> 맞음', () => {
  assert.equal(deriveStatus(['맞음']), '맞음');
});
test('첫 시도 틀림 하나 -> 틀림', () => {
  assert.equal(deriveStatus(['틀림']), '틀림');
});
test('틀림, 틀림, 맞음 -> 해결 (완성 기준)', () => {
  assert.equal(deriveStatus(['틀림', '틀림', '맞음']), '해결');
});
test('틀림, 맞음, 틀림 -> 마지막이 틀림이라 틀림', () => {
  assert.equal(deriveStatus(['틀림', '맞음', '틀림']), '틀림');
});
test('맞음, 맞음 -> 틀린 적이 없으므로 맞음', () => {
  assert.equal(deriveStatus(['맞음', '맞음']), '맞음');
});
test('맞음, 틀림, 맞음 -> 틀린 적이 있고 마지막이 맞음이라 해결', () => {
  assert.equal(deriveStatus(['맞음', '틀림', '맞음']), '해결');
});
test('시도가 없으면 null', () => {
  assert.equal(deriveStatus([]), null);
});
test('알 수 없는 결과값은 오류', () => {
  assert.throws(() => deriveStatus(['통과']));
});
