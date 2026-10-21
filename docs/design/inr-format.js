/** Indian digit grouping: 1,24,509.82. Use for every rupee value on screen and in PDFs. */
export const formatINR = (value, { decimals = 2, symbol = '₹' } = {}) =>
  symbol + new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);

/** Compact form for donut centres and KPI sub-labels: ₹1.5 lakh, ₹2.3 crore. */
export const formatINRCompact = (value) => {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)} crore`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)} lakh`;
  return formatINR(value, { decimals: 0 });
};
