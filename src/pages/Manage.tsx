import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { School as SchoolIcon, BookOpen, Users } from 'lucide-react';
import Schools from './Schools';
import Classes from './Classes';
import Students from './Students';

const Manage = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'schools';

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', v);
    setParams(next, { replace: true });
  };

  return (
    <DashboardLayout>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="schools" className="flex items-center gap-1.5">
            <SchoolIcon className="w-3.5 h-3.5" /> Schools
          </TabsTrigger>
          <TabsTrigger value="classes" className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Classes
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Students
          </TabsTrigger>
        </TabsList>
        <TabsContent value="schools" forceMount hidden={tab !== 'schools'}>
          <Schools />
        </TabsContent>
        <TabsContent value="classes" forceMount hidden={tab !== 'classes'}>
          <Classes />
        </TabsContent>
        <TabsContent value="students" forceMount hidden={tab !== 'students'}>
          <Students />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Manage;
