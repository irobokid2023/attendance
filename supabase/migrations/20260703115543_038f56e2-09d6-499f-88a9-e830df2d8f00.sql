CREATE TABLE public.curriculum (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_name TEXT NOT NULL,
  session_no INTEGER NOT NULL,
  topic_name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_name, session_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum TO authenticated;
GRANT ALL ON public.curriculum TO service_role;

ALTER TABLE public.curriculum ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view curriculum" ON public.curriculum FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert curriculum" ON public.curriculum FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update curriculum" ON public.curriculum FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete curriculum" ON public.curriculum FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_curriculum_updated_at BEFORE UPDATE ON public.curriculum FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_curriculum_program ON public.curriculum(program_name);