const parseAsUtcIfNoTimezone = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  const raw = String(value);
  // PostgreSQL timestamp (without timezone) 會回傳無時區字串，這裡統一視為 UTC
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  return new Date(normalized);
};

export const formatTaipeiDateTime = (value) => {
  const date = parseAsUtcIfNoTimezone(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour12: false
  });
};

export const formatTaipeiDate = (value) => {
  const date = parseAsUtcIfNoTimezone(value);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei'
  });
};
