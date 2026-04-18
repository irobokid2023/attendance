import { supabase } from '@/integrations/supabase/client';

// Supabase has a default 1000-row limit per query. These helpers paginate
// through tables to fetch all matching rows.

const PAGE_SIZE = 1000;
const SAFETY_CAP = 200; // up to 200,000 rows

/**
 * Generic paginated fetcher for any table. Accepts a builder that returns a
 * filtered query (without .range), and pages through all results.
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
  let from = 0;
  for (let i = 0; i < SAFETY_CAP; i++) {
    const { data, error } = await builder().range(from, from + PAGE_SIZE - 1);
    if (error) break;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// Backwards-compatible specialized helper used by Classes/Schools session-counting.
export async function fetchAllAttendanceSessions(): Promise<Array<{ class_id: string; date: string; topic: string | null }>> {
  return fetchAllPaginated(() =>
    supabase.from('attendance').select('class_id, date, topic'),
  );
}
