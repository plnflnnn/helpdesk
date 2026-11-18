import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  InboxIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Role } from '@helpdesk/shared';
import { useCurrentUser, useLogout } from '@/auth/useAuth';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only users with this role see the item. */
  role?: Role;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboardIcon },
  { to: '/tickets', label: 'Tickets', icon: InboxIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, role: Role.admin },
];

/** Matches Tailwind's `md` breakpoint: the sidebar is always shown from here up. */
const DESKTOP_QUERY = '(min-width: 48rem)';

/** True on desktop widths. Assumes desktop where `matchMedia` is missing (tests, old browsers). */
function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_QUERY).matches,
  );
}

function Brand() {
  return (
    <span className="font-display text-lg font-semibold tracking-tight text-white">Helpdesk</span>
  );
}

export function AppLayout() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const isDesktop = useIsDesktop();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the phone menu after navigating.
  const [lastPath, setLastPath] = useState(location.pathname);
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  if (!user) {
    return null;
  }
  const visibleItems = navItems.filter((item) => !item.role || item.role === user.role);
  // On phones the sidebar is a drawer: hidden from everyone (and the keyboard) while closed.
  const sidebarHidden = !isDesktop && !menuOpen;

  return (
    <div className="min-h-screen md:flex">
      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar px-4 md:hidden">
        <Brand />
        <button
          type="button"
          className="-mr-2 inline-flex size-10 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon className="size-5" aria-hidden />
        </button>
      </header>

      {menuOpen && !isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/40 animate-in fade-in-0 motion-reduce:animate-none"
          aria-hidden
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        inert={sidebarHidden}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 motion-reduce:transition-none',
          'md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:shrink-0 md:translate-x-0',
          sidebarHidden ? '-translate-x-full' : 'translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between px-5 md:h-16">
          <Brand />
          <button
            type="button"
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            <XIcon className="size-5" aria-hidden />
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-0.5 px-3 py-2">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                  isActive &&
                    'bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-sidebar-primary',
                )
              }
            >
              <Icon className="size-[1.125rem]" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary font-display text-sm font-semibold text-sidebar-primary-foreground"
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-white">{user.name}</span>
              <span className="text-xs text-sidebar-foreground/70 capitalize">{user.role}</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-50"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOutIcon className="size-4" aria-hidden />
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/** "Alan Agent" → "AA"; one letter for a single name. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
