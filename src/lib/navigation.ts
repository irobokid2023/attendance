import {
  LayoutDashboard,
  School,
  ClipboardCheck,
  CalendarDays,
  Award,
  MessageSquareText,
  History,
  IndianRupee,
  ListChecks,
  ShieldCheck,
  Settings2,
  Upload,
  CalendarClock,
  Users2,
  BarChart3,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  adminOnly?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

export const navSections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
    ],
  },
  {
    id: 'daily',
    label: 'Daily Work',
    items: [
      { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
      { to: '/media', icon: Upload, label: 'Upload Media' },
      { to: '/topics', icon: MessageSquareText, label: 'Topic of the Day' },
      { to: '/grading', icon: Award, label: 'Grading' },
      { to: '/misc-tasks', icon: ListChecks, label: 'Miscellaneous Tasks' },
    ],
  },
  {
    id: 'data',
    label: 'Master Data',
    items: [
      { to: '/manage', icon: School, label: 'Schools / Classes / Students' },
      { to: '/payments', icon: IndianRupee, label: 'Payments' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/schedule', icon: CalendarClock, label: 'Instructor Schedule', adminOnly: true },
      { to: '/instructor-attendance', icon: Users2, label: 'Instructor Attendance', adminOnly: true },
      { to: '/analytics', icon: BarChart3, label: 'Analytics', adminOnly: true },
      { to: '/attendance-qa', icon: Sparkles, label: 'Ask Attendance', adminOnly: true },
      { to: '/activity-log', icon: History, label: 'Activity Log', adminOnly: true },
      { to: '/admin', icon: ShieldCheck, label: 'Admin Management', adminOnly: true },
      { to: '/admin-settings', icon: Settings2, label: 'Admin Settings', adminOnly: true },
    ],
  },
];

// Not shown in the sidebar, but reachable from the palette / breadcrumbs.
export const extraNavItems: NavItem[] = [
  { to: '/profile', icon: User, label: 'Profile' },
];

export const allNavItems: NavItem[] = [
  ...navSections.flatMap((s) => s.items),
  ...extraNavItems,
];

export const visibleSections = (role: string | null): NavSection[] =>
  navSections
    .filter((s) => !s.adminOnly || role === 'admin')
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.adminOnly || role === 'admin') }))
    .filter((s) => s.items.length > 0);

export const findNavItem = (path: string): NavItem | undefined =>
  allNavItems.find((i) => i.to === path);
