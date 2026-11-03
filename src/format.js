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

module.exports = { formatKst };
