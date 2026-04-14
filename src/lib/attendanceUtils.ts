// Statuses that count as "attended" for session/attendance counting
export const ATTENDED_STATUSES = ['present', 'kit', 'quiz'];

export function isAttended(status: string | undefined | null): boolean {
  return !!status && ATTENDED_STATUSES.includes(status);
}
