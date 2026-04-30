-- Fix privilege escalation: only admins can manage user_roles
DROP POLICY IF EXISTS "Instructors can manage roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keep existing self-view policy ("Users can view own roles") so users can read their own role on login.
-- Drop the self-insert policy: roles must only be assigned by admins (or by the signup trigger, which runs as SECURITY DEFINER and bypasses RLS).
DROP POLICY IF EXISTS "Users can insert own role on signup" ON public.user_roles;