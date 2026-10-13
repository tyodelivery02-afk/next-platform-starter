// Aggregate city records overlap the wards used by the map.
export const MUNICIPAL_AGGREGATE_CODES = new Set([
  '01100', '04100', '11100', '12100', '13100', '14100', '14130', '14150',
  '15100', '22100', '22130', '23100', '26100', '27100', '27140',
  '28100', '33100', '34100', '40100', '40130', '43100',
]);

export function isMunicipalityCode(code) {
  return /^\d{5}$/.test(code) && !code.endsWith('000') && !MUNICIPAL_AGGREGATE_CODES.has(code);
}

export function numericStat(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
