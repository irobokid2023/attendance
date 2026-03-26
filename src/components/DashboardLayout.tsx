import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={isMobile ? 'p-4 pt-16' : 'ml-64 p-8'}>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
