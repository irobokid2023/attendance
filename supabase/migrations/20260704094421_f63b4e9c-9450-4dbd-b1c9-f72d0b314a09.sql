
CREATE TABLE public.instructor_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  location text,
  check_in_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_at timestamptz,
  check_out_lat double precision,
  check_out_lng double precision,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instructor_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instructor_attendance TO authenticated;
GRANT ALL ON public.instructor_attendance TO service_role;

ALTER TABLE public.instructor_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage instructor attendance"
  ON public.instructor_attendance FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Instructors view own attendance"
  ON public.instructor_attendance FOR SELECT
  TO authenticated
  USING (instructor_id = auth.uid());

CREATE TRIGGER update_instructor_attendance_updated_at
  BEFORE UPDATE ON public.instructor_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_instructor_attendance_date ON public.instructor_attendance(date DESC);
CREATE INDEX idx_instructor_attendance_instructor ON public.instructor_attendance(instructor_id);
