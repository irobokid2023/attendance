import { supabase } from '@/integrations/supabase/client';

type Section = 'schools' | 'classes' | 'students' | 'attendance' | 'grading' | 'topics' | 'holidays' | 'payments' | 'misc_tasks' | 'profile';
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    let userName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';

    if (!userName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      userName = profile?.full_name?.trim() || '';
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: userName || user.email || 'Unknown',
      action,
      section,
      description,
      metadata,
    });
  } catch {
    // Silently fail - logging should never break the app
  }
};
