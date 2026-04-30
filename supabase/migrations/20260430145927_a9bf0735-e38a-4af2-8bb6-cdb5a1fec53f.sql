CREATE POLICY "Admins can manage holidays"
ON public.holidays
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));