import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { NavPrefsProvider } from "@/hooks/useNavPrefs";
import ProtectedRoute from "@/components/ProtectedRoute";

import InstallPrompt from "@/components/InstallPrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Schools from "./pages/Schools";
import Classes from "./pages/Classes";
import Students from "./pages/Students";
import Manage from "./pages/Manage";
import Attendance from "./pages/Attendance";
import MediaUpload from "./pages/MediaUpload";
import TopicOfTheDay from "./pages/TopicOfTheDay";
import Payments from "./pages/Payments";
import MiscTasks from "./pages/MiscTasks";
import HolidayCalendar from "./pages/HolidayCalendar";
import Grading from "./pages/Grading";
import Profile from "./pages/Profile";
import ActivityLog from "./pages/ActivityLog";
import AdminManagement from "./pages/AdminManagement";
import AdminSettings from "./pages/AdminSettings";
import AdminSchedule from "./pages/AdminSchedule";
import InstructorAttendance from "./pages/InstructorAttendance";
import Analytics from "./pages/Analytics";
import ResetPassword from "./pages/ResetPassword";
import MarketingDailyLog from "./pages/MarketingDailyLog";
import MarketingDatabase from "./pages/MarketingDatabase";
import MarketingHistory from "./pages/MarketingHistory";
import MarketingCurriculum from "./pages/MarketingCurriculum";
import FliteSchools from "./pages/FliteSchools";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPrompt />
      <BrowserRouter>
        <AuthProvider>
          <NavPrefsProvider>
          <Routes>

            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/schools" element={<ProtectedRoute><Schools /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
            <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="/manage" element={<ProtectedRoute><Manage /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/media" element={<ProtectedRoute><MediaUpload /></ProtectedRoute>} />
            <Route path="/topics" element={<ProtectedRoute><TopicOfTheDay /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/misc-tasks" element={<ProtectedRoute><MiscTasks /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><HolidayCalendar /></ProtectedRoute>} />
            <Route path="/grading" element={<ProtectedRoute><Grading /></ProtectedRoute>} />
            <Route path="/activity-log" element={<ProtectedRoute adminOnly><ActivityLog /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminManagement /></ProtectedRoute>} />
            <Route path="/admin-settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute adminOnly><AdminSchedule /></ProtectedRoute>} />
            <Route path="/instructor-attendance" element={<ProtectedRoute adminOnly><InstructorAttendance /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute adminOnly><Analytics /></ProtectedRoute>} />
            <Route path="/marketing-log" element={<ProtectedRoute adminOnly><MarketingDailyLog /></ProtectedRoute>} />
            <Route path="/marketing-database" element={<ProtectedRoute adminOnly><MarketingDatabase /></ProtectedRoute>} />
            <Route path="/marketing-history" element={<ProtectedRoute adminOnly><MarketingHistory /></ProtectedRoute>} />
            <Route path="/marketing-curriculum" element={<ProtectedRoute adminOnly><MarketingCurriculum /></ProtectedRoute>} />
            <Route path="/flite-schools" element={<ProtectedRoute adminOnly><FliteSchools /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </NavPrefsProvider>
        </AuthProvider>

      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
