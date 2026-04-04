
CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  topic TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_topics_class_date_topic ON public.topics (class_id, date, topic);

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view topics"
ON public.topics FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Instructors can manage topics"
ON public.topics FOR ALL
USING (has_role(auth.uid(), 'instructor'::app_role));
