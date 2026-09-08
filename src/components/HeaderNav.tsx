import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Clock, Home } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNavPrefs } from '@/hooks/useNavPrefs';
import { findNavItem, type NavItem } from '@/lib/navigation';

// Persistent breadcrumbs + a recent-pages dropdown for one-click backtracking.
const HeaderNav = () => {
  const { pathname } = useLocation();
  const { recents } = useNavPrefs();
  const current = findNavItem(pathname);
  const others = recents
    .filter((p) => p !== pathname)
    .map(findNavItem)
    .filter((i): i is NavItem => Boolean(i));

  return (
    <div className="flex items-center gap-1 min-w-0">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 text-sm">
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Home</span>
        </Link>
        {current && current.to !== '/dashboard' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <span className="font-medium text-foreground truncate">{current.label}</span>
          </>
        )}
      </nav>

      {others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Recent pages">
              <Clock className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Recent pages</DropdownMenuLabel>
            {others.map((item) => (
              <DropdownMenuItem key={item.to} asChild className="cursor-pointer">
                <Link to={item.to} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default HeaderNav;
