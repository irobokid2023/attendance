
CREATE TABLE public.grading (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  grade_value TEXT NOT NULL,
  marked_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grading ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view grading" ON public.grading FOR SELECT TO authenticated USING (true);
CREATE POLICY "Instructors can manage grading" ON public.grading FOR ALL USING (has_role(auth.uid(), 'instructor'::app_role));
