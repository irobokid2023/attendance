import { supabase } from '@/integrations/supabase/client';

// Supabase has a default 1000-row limit per query. These helpers paginate
// through tables to fetch all matching rows.

const PAGE_SIZE = 1000;
const SAFETY_CAP = 200; // up to 200,000 rows
const CONCURRENCY = 5; // pages fetched in parallel per batch

/**
 * Generic paginated fetcher for any table. Accepts a builder that returns a
 * filtered query (without .range), and pages through all results.
 *
 * Pages are fetched in parallel batches which is dramatically faster than the
 * previous sequential loop on large tables (attendance, students).
 *
 * Usage:
 *   const rows = await fetchAllPaginated(() =>
 *     supabase.from('attendance').select('*').eq('class_id', id)
 *   );
 */
export async function fetchAllPaginated<T = any>(
  builder: () => any,
): Promise<T[]> {
  const all: T[] = [];
  let pageIndex = 0;

  while (pageIndex < SAFETY_CAP) {
    const batch = Array.from({ length: CONCURRENCY }, (_, i) => pageIndex + i);
    const results = await Promise.all(
      batch.map((p) => builder().range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)),
    );

    let done = false;
    for (const { data, error } of results) {
      if (error) { done = true; break; }
      const rows = (data ?? []) as T[];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) { done = true; break; }
    }
    if (done) break;
    pageIndex += CONCURRENCY;
  }

  return all;
}

// Backwards-compatible specialized helper used by Classes/Schools session-counting.
export async function fetchAllAttendanceSessions(): Promise<Array<{ class_id: string; date: string; topic: string | null }>> {
  return fetchAllPaginated(() =>
    supabase.from('attendance').select('class_id, date, topic'),
  );
}
