import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <header className={cn(
        'fixed top-0 right-0 z-40 flex items-center justify-end h-14 px-6 bg-background/80 backdrop-blur-sm border-b border-border/50',
        isMobile ? 'left-0' : 'left-64'
      )}>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground gap-2">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </header>
      <main className={cn(isMobile ? 'p-4 pt-20' : 'ml-64 p-8 pt-20')}>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
