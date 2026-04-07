import { supabase } from '@/integrations/supabase/client';

type Section = 'schools' | 'classes' | 'students' | 'attendance' | 'grading' | 'topics' | 'holidays';
type Action = 'created' | 'updated' | 'deleted' | 'imported' | 'duplicated' | 'exported';

export const logActivity = async ({
  action,
  section,
  description,
  metadata = {},
}: {
  action: Action;
  section: Section;
  description: string;
  metadata?: Record<string, any>;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email || 'Unknown',
      action,
      section,
      description,
      metadata,
    });
  } catch {
    // Silently fail - logging should never break the app
  }
};
