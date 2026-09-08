-- Helper: has any assigned role
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

REVOKE ALL ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid) TO authenticated, service_role;

-- activity_logs: admins all, users own
DROP POLICY IF EXISTS "Authenticated users can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins view all activity logs" ON public.activity_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own activity logs" ON public.activity_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- payments
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
CREATE POLICY "Roled users can view payments" ON public.payments
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

-- schools
DROP POLICY IF EXISTS "Authenticated users can view schools" ON public.schools;
CREATE POLICY "Roled users can view schools" ON public.schools
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

-- students
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
CREATE POLICY "Roled users can view students" ON public.students
FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid()));

-- Re-scope instructor manage policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Instructors can manage attendance" ON public.attendance;
CREATE POLICY "Instructors can manage attendance" ON public.attendance
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage classes" ON public.classes;
CREATE POLICY "Instructors can manage classes" ON public.classes
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage grading" ON public.grading;
CREATE POLICY "Instructors can manage grading" ON public.grading
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage holidays" ON public.holidays;
CREATE POLICY "Instructors can manage holidays" ON public.holidays
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage misc_tasks" ON public.misc_tasks;
CREATE POLICY "Instructors can manage misc_tasks" ON public.misc_tasks
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage payments" ON public.payments;
CREATE POLICY "Instructors can manage payments" ON public.payments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage schools" ON public.schools;
CREATE POLICY "Instructors can manage schools" ON public.schools
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage students" ON public.students;
CREATE POLICY "Instructors can manage students" ON public.students
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can manage topics" ON public.topics;
CREATE POLICY "Instructors can manage topics" ON public.topics
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Instructors can view all profiles" ON public.profiles;
CREATE POLICY "Instructors can view all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'instructor') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.delete_old_activity_logs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_old_topics() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Storage size report: admin only, enforced in-function
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE(table_name text, total_bytes bigint, table_bytes bigint, index_bytes bigint, row_estimate bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    c.relname::text,
    pg_total_relation_size(c.oid)::bigint,
    pg_table_size(c.oid)::bigint,
    pg_indexes_size(c.oid)::bigint,
    c.reltuples::bigint
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_table_sizes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_table_sizes() TO authenticated, service_role;