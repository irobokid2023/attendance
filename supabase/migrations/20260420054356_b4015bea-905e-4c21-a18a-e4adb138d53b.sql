-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('paid', 'not_paid');

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  status public.payment_status NOT NULL,
  marked_by UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE INDEX idx_payments_class_id ON public.payments(class_id);
CREATE INDEX idx_payments_school_id ON public.payments(school_id);
CREATE INDEX idx_payments_student_id ON public.payments(student_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
ON public.payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Instructors can manage payments"
ON public.payments FOR ALL
USING (public.has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Users can insert payments they mark"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = marked_by);

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();