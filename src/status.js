// 시도 결과('맞음'/'틀림')를 시도 순서대로 받아 문제 상태를 돌려준다.
//   첫 시도에 맞힘                  -> '맞음'
//   마지막 시도가 틀림              -> '틀림'
//   틀린 적 있고 마지막 시도 맞음   -> '해결'
function deriveStatus(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  for (const r of results) {
    if (r !== '맞음' && r !== '틀림') throw new Error(`알 수 없는 결과: ${r}`);
  }
  const last = results[results.length - 1];
  if (last === '틀림') return '틀림';
  return results[0] === '맞음' ? '맞음' : '해결';
}

module.exports = { deriveStatus };
