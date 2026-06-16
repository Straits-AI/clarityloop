/** Maps an entropy component (0..1) to an HSL heat color: green(low) -> red(high). */
export function entropyColor(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  const hue = Math.round((1 - v) * 120); // 120=green at 0, 0=red at 1
  return `hsl(${hue}, 70%, 45%)`;
}
