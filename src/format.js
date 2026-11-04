const kst = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// UTC ISO 문자열을 한국 시간 표기로 바꾼다.
function formatKst(iso) {
  return kst.format(new Date(iso));
}

// 문제 내용의 첫 줄(빈 줄 제외)을 돌려준다. max자를 넘으면 자르고 '…'를 붙인다.
function firstLine(content, max = 40) {
  const line = String(content).split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') || '';
  const chars = Array.from(line);
  return chars.length > max ? chars.slice(0, max).join('') + '…' : line;
}

module.exports = { formatKst, firstLine };
