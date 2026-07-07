
-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated view notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.notification_reads (
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reads" ON public.notification_reads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Curriculum: admin-only mutations, all authenticated can view
DROP POLICY IF EXISTS "Authenticated can insert curriculum" ON public.curriculum;
DROP POLICY IF EXISTS "Authenticated can update curriculum" ON public.curriculum;
DROP POLICY IF EXISTS "Authenticated can delete curriculum" ON public.curriculum;
CREATE POLICY "Admins insert curriculum" ON public.curriculum FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update curriculum" ON public.curriculum FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete curriculum" ON public.curriculum FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Instructor attendance: allow instructors to check themselves in/out
CREATE POLICY "Instructors insert own attendance" ON public.instructor_attendance FOR INSERT TO authenticated WITH CHECK (instructor_id = auth.uid());
CREATE POLICY "Instructors update own attendance" ON public.instructor_attendance FOR UPDATE TO authenticated USING (instructor_id = auth.uid()) WITH CHECK (instructor_id = auth.uid());
