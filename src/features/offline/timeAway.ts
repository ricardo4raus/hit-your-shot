/**
 * Short time-away text for the welcome-back panel: "1 h 12 min", "45 min", "2 h", "1 d 3 h". Two units at most, the smaller one dropped
 * when it is zero. Anything under a minute reads "1 min" (the offline rule pays nothing below balance.offline.minSecondsAway anyway).
 */
export function formatTimeAway(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const totalMinutes = Math.max(1, Math.floor(s / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
}
