CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name text NOT NULL DEFAULT 'iRobokid',
  tagline text NOT NULL DEFAULT 'Attendance Management',
  primary_color text NOT NULL DEFAULT '#14b8a6',
  academic_year text NOT NULL DEFAULT '2025-2026',
  default_class_duration_minutes integer NOT NULL DEFAULT 60,
  notify_holiday_alerts boolean NOT NULL DEFAULT true,
  notify_attendance_reminders boolean NOT NULL DEFAULT false,
  reminder_time time NOT NULL DEFAULT '09:00',
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;