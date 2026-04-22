import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Users,
  FileClock,
  Flag,
  CalendarClock,
  Shield,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/admin/hooks/useIsAdmin';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const NAV = [
  { to: '/admin',          label: 'Dashboard',    icon: LayoutDashboard, end: true },
  { to: '/admin/economy',  label: 'Économie',     icon: SlidersHorizontal },
  { to: '/admin/players',  label: 'Joueurs',      icon: Users },
  { to: '/admin/events',   label: 'Événements',   icon: CalendarClock },
  { to: '/admin/flags',    label: 'Feature flags',icon: Flag },
  { to: '/admin/audit',    label: 'Audit',        icon: FileClock },
  { to: '/admin/admins',   label: 'Admins',       icon: Shield, superadminOnly: true },
];

export const AdminLayout = ({ children, title, subtitle, actions }: AdminLayoutProps) => {
  const { superadmin } = useIsAdmin();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 w-60 border-r bg-background p-4 hidden md:flex md:flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <Shield className="h-5 w-5 text-pink-600" />
          <span className="font-semibold">Admin</span>
        </div>
        {NAV.filter((item) => !item.superadminOnly || superadmin).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
        <div className="mt-auto pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => navigate('/garden')}
          >
            <Home className="h-4 w-4" />
            Retour au jeu
          </Button>
        </div>
      </aside>

      <main className="md:pl-60">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="shrink-0 flex items-center gap-2">{actions}</div>
        </header>

        <div className="p-6 space-y-6">{children}</div>
      </main>
    </div>
  );
};
