import { InboxIcon, LifeBuoyIcon, LogOutIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { Role } from '@helpdesk/shared';
import { useCurrentUser, useLogout } from '@/auth/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only users with this role see the item. */
  role?: Role;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Tickets', icon: InboxIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, role: Role.admin },
];

export function AppLayout() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  if (!user) {
    return null;
  }
  const visibleItems = navItems.filter((item) => !item.role || item.role === user.role);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <LifeBuoyIcon className="size-5 text-primary" aria-hidden />
          Helpdesk
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 p-2">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive && 'bg-muted font-medium text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b bg-background px-6">
          <span className="text-sm font-medium">{user.name}</span>
          <Badge
            variant={user.role === Role.admin ? 'default' : 'secondary'}
            className="capitalize"
          >
            {user.role}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOutIcon data-icon="inline-start" aria-hidden />
            Log out
          </Button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
