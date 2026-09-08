import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, Menu, Star, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavPrefs, MAX_FAVORITES } from '@/hooks/useNavPrefs';
import { visibleSections, findNavItem, type NavItem } from '@/lib/navigation';
import { useState, useEffect } from 'react';

const NavRow = ({
  item,
  isActive,
  onNavClick,
}: {
  item: NavItem;
  isActive: boolean;
  onNavClick?: () => void;
}) => {
  const { isFavorite, toggleFavorite, favorites } = useNavPrefs();
  const pinned = isFavorite(item.to);
  const atLimit = !pinned && favorites.length >= MAX_FAVORITES;
  const Icon = item.icon;

  return (
    <div className="group/row relative flex items-center">
      <NavLink
        to={item.to}
        onClick={onNavClick}
        className={cn(
          'group flex flex-1 min-w-0 items-center gap-3 pl-3 pr-8 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200',
          isActive
            ? 'bg-sidebar-primary/15 text-sidebar-primary shadow-sm'
            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
      >
        <Icon
          className={cn(
            'w-[18px] h-[18px] shrink-0 transition-colors',
            isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground'
          )}
        />
        <span className="truncate">{item.label}</span>
      </NavLink>
      <button
        type="button"
        onClick={() => toggleFavorite(item.to)}
        disabled={atLimit}
        aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
        title={atLimit ? `You can pin up to ${MAX_FAVORITES} pages` : pinned ? 'Unpin' : 'Pin to favorites'}
        className={cn(
          'absolute right-1.5 p-1 rounded-md transition-opacity',
          pinned
            ? 'text-sidebar-primary opacity-100'
            : 'text-sidebar-foreground/50 opacity-0 group-hover/row:opacity-100 hover:text-sidebar-primary disabled:cursor-not-allowed'
        )}
      >
        <Star className={cn('w-3.5 h-3.5', pinned && 'fill-current')} />
      </button>
    </div>
  );
};

const SidebarContent = ({ onNavClick, role }: { onNavClick?: () => void; role: string | null }) => {
  const location = useLocation();
  const { favorites, isSectionOpen, toggleSection } = useNavPrefs();
  const sections = visibleSections(role);
  const favItems = favorites
    .map(findNavItem)
    .filter((i): i is NavItem => Boolean(i));

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Brand */}
      <div className="p-4 sm:p-5 pb-5 flex items-center gap-3 border-b border-sidebar-border">
        <img src="/logo.ico" alt="iRobokid" className="w-9 h-9 rounded-xl shadow-md shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-bold text-sidebar-primary-foreground text-base leading-tight tracking-tight truncate">iRobokid</h2>
          {role && (
            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-sidebar-primary/15 text-sidebar-primary text-[10px] font-semibold uppercase tracking-wider max-w-full truncate">
              {role === 'admin' ? 'Admin' : 'Instructor'}
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 mt-4 space-y-3 overflow-y-auto pb-4">
        {favItems.length > 0 && (
          <div>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Favorites
            </p>
            <div className="space-y-0.5">
              {favItems.map((item) => (
                <NavRow
                  key={`fav-${item.to}`}
                  item={item}
                  isActive={location.pathname === item.to}
                  onNavClick={onNavClick}
                />
              ))}
            </div>
          </div>
        )}

        {sections.map((section) => {
          const open = isSectionOpen(section.id);
          return (
            <Collapsible key={section.id} open={open} onOpenChange={() => toggleSection(section.id)}>
              <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
                <span>{section.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !open && '-rotate-90')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-0.5">
                {section.items.map((item) => (
                  <NavRow
                    key={item.to}
                    item={item}
                    isActive={location.pathname === item.to}
                    onNavClick={onNavClick}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50 flex items-center gap-1.5">
        <Search className="w-3 h-3" />
        Press <kbd className="px-1 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground">Ctrl</kbd>+
        <kbd className="px-1 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground">K</kbd>
      </div>
    </div>
  );
};

const AppSidebar = () => {
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-sidebar flex items-center justify-center text-sidebar-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <SidebarContent onNavClick={() => setOpen(false)} role={role} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-50 shadow-xl">
      <SidebarContent role={role} />
    </aside>
  );
};

export default AppSidebar;
