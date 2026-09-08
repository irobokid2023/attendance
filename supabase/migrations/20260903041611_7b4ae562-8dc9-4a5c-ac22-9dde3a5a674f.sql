CREATE TYPE public.marketing_visit_status AS ENUM ('interested', 'follow_up', 'deal_closed', 'not_interested');
CREATE TYPE public.flite_status AS ENUM ('prospect', 'active', 'paused', 'churned');

-- ============ MARKETING SCHOOLS ============
CREATE TABLE public.marketing_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  area TEXT,
  city TEXT,
  board TEXT,
  type TEXT,
  website TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_schools TO authenticated;
GRANT ALL ON public.marketing_schools TO service_role;
ALTER TABLE public.marketing_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marketing_schools" ON public.marketing_schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_marketing_schools_updated BEFORE UPDATE ON public.marketing_schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_school_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.marketing_schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  designation TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_school_contacts TO authenticated;
GRANT ALL ON public.marketing_school_contacts TO service_role;
ALTER TABLE public.marketing_school_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marketing_school_contacts" ON public.marketing_school_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.marketing_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.marketing_schools(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.marketing_visit_status NOT NULL DEFAULT 'interested',
  coordinator_id UUID,
  agenda TEXT,
  outcome TEXT,
  next_follow_up DATE,
  amount NUMERIC(12,2),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_visits TO authenticated;
GRANT ALL ON public.marketing_visits TO service_role;
ALTER TABLE public.marketing_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marketing_visits" ON public.marketing_visits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_marketing_visits_updated BEFORE UPDATE ON public.marketing_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_school_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.marketing_schools(id) ON DELETE CASCADE,
  changed_by UUID,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.marketing_school_history TO authenticated;
GRANT ALL ON public.marketing_school_history TO service_role;
ALTER TABLE public.marketing_school_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read marketing_school_history" ON public.marketing_school_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert marketing_school_history" ON public.marketing_school_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ FLITE ============
CREATE TABLE public.flite_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_full_name TEXT,
  region TEXT,
  tier TEXT,
  status public.flite_status NOT NULL DEFAULT 'prospect',
  owner_id UUID,
  notes TEXT,
  contact_no TEXT,
  address TEXT,
  city TEXT,
  principal_name TEXT,
  principal_contact TEXT,
  principal_email TEXT,
  school_coord_name TEXT,
  school_coord_contact TEXT,
  school_coord_email TEXT,
  mktg_coord_name TEXT,
  mktg_coord_contact TEXT,
  mktg_coord_email TEXT,
  payment_terms TEXT,
  invoice_name TEXT,
  training_dates TEXT,
  training_days_committed TEXT,
  training_mode TEXT,
  kit_delivery_date DATE,
  welcome_kit_delivered_date DATE,
  teachers_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_schools TO authenticated;
GRANT ALL ON public.flite_schools TO service_role;
ALTER TABLE public.flite_schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_schools" ON public.flite_schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_schools_updated BEFORE UPDATE ON public.flite_schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  course_name TEXT,
  grade TEXT,
  kit_cost NUMERIC,
  no_of_kits INTEGER,
  kit_student_sharing TEXT,
  shelf_life TEXT,
  divisions_per_grade INTEGER,
  curriculum_file_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_programs TO authenticated;
GRANT ALL ON public.flite_programs TO service_role;
ALTER TABLE public.flite_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_programs" ON public.flite_programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_programs_updated BEFORE UPDATE ON public.flite_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_welcome_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  date_delivered DATE,
  delivered_by TEXT,
  delivered_to TEXT,
  items TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_welcome_deliveries TO authenticated;
GRANT ALL ON public.flite_welcome_deliveries TO service_role;
ALTER TABLE public.flite_welcome_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_welcome_deliveries" ON public.flite_welcome_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_welcome_deliveries_updated BEFORE UPDATE ON public.flite_welcome_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_kit_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  couriered_date DATE,
  tracking_id TEXT,
  program_name TEXT,
  quantity INTEGER,
  received_on DATE,
  prepared_by TEXT,
  checked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_kit_deliveries TO authenticated;
GRANT ALL ON public.flite_kit_deliveries TO service_role;
ALTER TABLE public.flite_kit_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_kit_deliveries" ON public.flite_kit_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_kit_deliveries_updated BEFORE UPDATE ON public.flite_kit_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_school_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  full_name TEXT,
  courses TEXT,
  subjects TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_school_teachers TO authenticated;
GRANT ALL ON public.flite_school_teachers TO service_role;
ALTER TABLE public.flite_school_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_school_teachers" ON public.flite_school_teachers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_school_teachers_updated BEFORE UPDATE ON public.flite_school_teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  flite_teacher_name TEXT,
  course TEXT,
  session_date DATE,
  hours TEXT,
  teachers_attended INTEGER,
  certificates_given_date DATE,
  mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_trainings TO authenticated;
GRANT ALL ON public.flite_trainings TO service_role;
ALTER TABLE public.flite_trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_trainings" ON public.flite_trainings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_trainings_updated BEFORE UPDATE ON public.flite_trainings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_refresher_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  flite_teacher_name TEXT,
  course TEXT,
  session_date DATE,
  hours TEXT,
  teachers_attended INTEGER,
  mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_refresher_sessions TO authenticated;
GRANT ALL ON public.flite_refresher_sessions TO service_role;
ALTER TABLE public.flite_refresher_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_refresher_sessions" ON public.flite_refresher_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_refresher_sessions_updated BEFORE UPDATE ON public.flite_refresher_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.flite_class_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.flite_schools(id) ON DELETE CASCADE,
  flite_teacher_name TEXT,
  course TEXT,
  session_date DATE,
  hours TEXT,
  school_teacher TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flite_class_observations TO authenticated;
GRANT ALL ON public.flite_class_observations TO service_role;
ALTER TABLE public.flite_class_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage flite_class_observations" ON public.flite_class_observations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_flite_class_observations_updated BEFORE UPDATE ON public.flite_class_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MARKETING CURRICULUM ============
CREATE TABLE public.marketing_curriculum_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age_group TEXT,
  duration_weeks INTEGER,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_curriculum_programs TO authenticated;
GRANT ALL ON public.marketing_curriculum_programs TO service_role;
ALTER TABLE public.marketing_curriculum_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marketing_curriculum_programs" ON public.marketing_curriculum_programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_marketing_curriculum_programs_updated BEFORE UPDATE ON public.marketing_curriculum_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_curriculum_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.marketing_curriculum_programs(id) ON DELETE CASCADE,
  session_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  objectives TEXT,
  materials TEXT,
  activities TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, session_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_curriculum_sessions TO authenticated;
GRANT ALL ON public.marketing_curriculum_sessions TO service_role;
ALTER TABLE public.marketing_curriculum_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage marketing_curriculum_sessions" ON public.marketing_curriculum_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));