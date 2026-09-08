import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useAuth } from '@/hooks/useAuth';
import { useNavPrefs } from '@/hooks/useNavPrefs';
import { findNavItem, visibleSections, extraNavItems, type NavItem } from '@/lib/navigation';
import { LogOut } from 'lucide-react';

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role, signOut } = useAuth();
  const { favorites, recents } = useNavPrefs();
  const sections = visibleSections(role);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const quick = [...favorites, ...recents.filter((r) => !favorites.includes(r))]
    .map(findNavItem)
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 6);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages… (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {quick.length > 0 && (
          <CommandGroup heading="Quick access">
            {quick.map((item) => (
              <CommandItem key={`q-${item.to}`} value={`quick ${item.label}`} onSelect={() => go(item.to)}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {sections.map((section) => (
          <CommandGroup key={section.id} heading={section.label}>
            {section.items.map((item) => (
              <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading="Account">
          {extraNavItems.map((item) => (
            <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
          <CommandSeparator />
          <CommandItem value="sign out logout" onSelect={() => { setOpen(false); signOut(); }}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
