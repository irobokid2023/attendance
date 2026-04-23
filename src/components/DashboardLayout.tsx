import { ReactNode, useEffect, useState } from 'react';
import AppSidebar from './AppSidebar';
import UserAvatar from './UserAvatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const { signOut, user } = useAuth();
  const [fullName, setFullName] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name || ''));
  }, [user]);

  const displayName = fullName || user?.email || '';

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <header className={cn(
        'fixed top-0 right-0 z-40 flex items-center justify-end gap-3 h-14 px-6 bg-background/80 backdrop-blur-sm border-b border-border/50',
        isMobile ? 'left-0 pl-16' : 'left-64'
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar name={fullName} email={user?.email} size="sm" />
          {!isMobile && (
            <div className="flex flex-col min-w-0 leading-tight">
              {fullName && (
                <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{fullName}</span>
              )}
              <span className={cn('text-muted-foreground truncate max-w-[180px]', fullName ? 'text-xs' : 'text-sm')}>
                {user?.email}
              </span>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground gap-2">
          <LogOut className="w-4 h-4" />
          {!isMobile && 'Sign Out'}
        </Button>
      </header>
      <main className={cn(isMobile ? 'p-4 pt-20' : 'ml-64 p-8 pt-20')}>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
