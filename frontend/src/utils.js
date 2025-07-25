// Utility helpers shared across pages

export const toAbsoluteUrl = (url) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

// Generate a sequence of serial numbers given the current count and additional quantity.
// Serial numbers are returned as strings like "고유번호_1".
export function appendSerialNumbers(existing = [], quantity = 0) {
  if (quantity <= 0) return existing.slice();
  const start = existing.length + 1;
  const newNumbers = Array.from({ length: quantity }, (_, i) => `고유번호_${start + i}`);
  return [...existing, ...newNumbers];
}
