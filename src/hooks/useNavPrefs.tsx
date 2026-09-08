import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { findNavItem } from '@/lib/navigation';

export const MAX_FAVORITES = 5;
const MAX_RECENTS = 5;

const read = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const write = (key: string, value: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

interface NavPrefsValue {
  favorites: string[];
  toggleFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
  recents: string[];
  openSections: string[];
  toggleSection: (id: string) => void;
  isSectionOpen: (id: string, fallback?: boolean) => boolean;
}

const NavPrefsContext = createContext<NavPrefsValue | null>(null);

export const NavPrefsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const scope = user?.id ?? 'anon';
  const favKey = `nav:favorites:${scope}`;
  const recentKey = `nav:recents:${scope}`;
  const sectionKey = `nav:sections:${scope}`;

  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [closedSections, setClosedSections] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(read(favKey));
    setRecents(read(recentKey));
    setClosedSections(read(sectionKey));
  }, [favKey, recentKey, sectionKey]);

  // Track visited pages for one-click backtracking.
  useEffect(() => {
    if (!findNavItem(pathname)) return;
    setRecents((prev) => {
      const next = [pathname, ...prev.filter((p) => p !== pathname)].slice(0, MAX_RECENTS);
      write(recentKey, next);
      return next;
    });
  }, [pathname, recentKey]);

  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path].slice(-MAX_FAVORITES);
      write(favKey, next);
      return next;
    });
  }, [favKey]);

  const toggleSection = useCallback((id: string) => {
    setClosedSections((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      write(sectionKey, next);
      return next;
    });
  }, [sectionKey]);

  const value = useMemo<NavPrefsValue>(() => ({
    favorites,
    toggleFavorite,
    isFavorite: (path: string) => favorites.includes(path),
    recents,
    openSections: closedSections,
    toggleSection,
    isSectionOpen: (id: string) => !closedSections.includes(id),
  }), [favorites, recents, closedSections, toggleFavorite, toggleSection]);

  return <NavPrefsContext.Provider value={value}>{children}</NavPrefsContext.Provider>;
};

export const useNavPrefs = (): NavPrefsValue => {
  const ctx = useContext(NavPrefsContext);
  if (ctx) return ctx;
  return {
    favorites: [],
    toggleFavorite: () => {},
    isFavorite: () => false,
    recents: [],
    openSections: [],
    toggleSection: () => {},
    isSectionOpen: () => true,
  };
};
