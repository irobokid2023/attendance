CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE(table_name text, total_bytes bigint, table_bytes bigint, index_bytes bigint, row_estimate bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    c.relname::text AS table_name,
    pg_total_relation_size(c.oid)::bigint AS total_bytes,
    pg_table_size(c.oid)::bigint AS table_bytes,
    pg_indexes_size(c.oid)::bigint AS index_bytes,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_table_sizes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated;