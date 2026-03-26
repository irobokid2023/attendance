
-- Drop dependent policies first
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage schools" ON public.schools;
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Admins can manage attendance" ON public.attendance;

-- Drop the function that depends on the enum
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Drop default and change column to text
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;

-- Update existing rows
UPDATE public.user_roles SET role = 'instructor' WHERE role IN ('admin', 'teacher');

-- Drop and recreate enum
DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('instructor');

-- Change column back
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'instructor'::app_role;

-- Recreate has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Recreate handle_new_user_role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'instructor');
  RETURN NEW;
END;
$$;

-- Recreate RLS policies with instructor
CREATE POLICY "Instructors can manage schools" ON public.schools FOR ALL TO public USING (has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructors can manage classes" ON public.classes FOR ALL TO public USING (has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructors can manage students" ON public.students FOR ALL TO public USING (has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructors can manage attendance" ON public.attendance FOR ALL TO public USING (has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructors can manage roles" ON public.user_roles FOR ALL TO public USING (has_role(auth.uid(), 'instructor'::app_role));
CREATE POLICY "Instructors can view all profiles" ON public.profiles FOR SELECT TO public USING (has_role(auth.uid(), 'instructor'::app_role));
