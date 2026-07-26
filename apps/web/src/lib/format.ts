export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatMoney(amount: number, { showSign = false }: { showSign?: boolean } = {}): string {
  const sign = showSign ? (amount >= 0 ? '+' : '-') : '';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}
