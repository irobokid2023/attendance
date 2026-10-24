type DraftEnvelope<T> = {
  version: 1;
  userId: string;
  savedAt: number;
  payload: T;
};

const keyFor = (userId: string, page: string) => `irobokid:page-draft:v1:${userId}:${page}`;

export const readPageDraft = <T,>(userId: string, page: string): T | null => {
  try {
    const raw = localStorage.getItem(keyFor(userId, page));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as DraftEnvelope<T>;
    if (envelope.version !== 1 || envelope.userId !== userId || envelope.payload === undefined) return null;
    return envelope.payload;
  } catch {
    return null;
  }
};

export const writePageDraft = <T,>(userId: string, page: string, payload: T): void => {
  try {
    const envelope: DraftEnvelope<T> = { version: 1, userId, savedAt: Date.now(), payload };
    localStorage.setItem(keyFor(userId, page), JSON.stringify(envelope));
  } catch {
    // Draft recovery is best-effort when browser storage is unavailable or full.
  }
};

export const clearPageDraft = (userId: string, page: string): void => {
  try {
    localStorage.removeItem(keyFor(userId, page));
  } catch {
    // Ignore storage access failures; the primary save has already completed.
  }
};