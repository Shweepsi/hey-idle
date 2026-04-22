import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCcw, TrendingUp, Users, Coins, Gem, Sparkles, Zap } from 'lucide-react';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { useAdminHealth, useAdminGlobalOverrides } from '@/admin/hooks/useAdminEconomy';
import { useAdminAuditLog } from '@/admin/hooks/useAdminAudit';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export const AdminDashboardPage = () => {
  const { data: health, isLoading, refetch, isRefetching } = useAdminHealth();
  const { overrides } = useAdminGlobalOverrides();
  const { data: recentAudit } = useAdminAuditLog(10, 0);

  const t = health?.totals;
  const maintenance = overrides?.maintenance_mode ?? false;

  return (
    <AdminLayout
      title="Dashboard économie"
      subtitle={health ? `Généré ${formatDistanceToNow(new Date(health.generated_at), { addSuffix: true, locale: fr })}` : undefined}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      }
    >
      {maintenance && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900 flex items-center gap-2">
            <Zap className="h-4 w-4" /> Mode maintenance actif — les RPCs économie retournent une erreur aux joueurs.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-blue-600" />}
          label="Joueurs totaux"
          value={t?.players ?? 0}
          sub={isLoading ? '' : `${t?.dau_24h ?? 0} actifs (24h) • ${t?.dau_7d ?? 0} (7j)`}
        />
        <StatCard
          icon={<Coins className="h-4 w-4 text-amber-600" />}
          label="Pièces gagnées (24h)"
          value={compact(t?.coins_earned_24h ?? 0)}
          sub={`${t?.harvests_24h ?? 0} récoltes`}
        />
        <StatCard
          icon={<Gem className="h-4 w-4 text-purple-600" />}
          label="Gemmes gagnées (24h)"
          value={compact(t?.gems_earned_24h ?? 0)}
          sub={`${t?.active_boosts ?? 0} boosts actifs`}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4 text-pink-600" />}
          label="Essence gagnée (24h)"
          value={compact(t?.essence_earned_24h ?? 0)}
          sub={`${t?.prestiges_24h ?? 0} prestiges`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Distribution du prestige</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {health?.prestige_distribution?.map((b) => {
              const pct = t?.players ? (b.n / t.players) * 100 : 0;
              return (
                <div key={b.prestige_level ?? 'n'} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Prestige {b.prestige_level ?? 0}</span>
                    <span className="text-muted-foreground">{b.n.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
            {(!health?.prestige_distribution || health.prestige_distribution.length === 0) && (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Activité (24h)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {health?.event_counts_24h?.map((b) => (
              <div key={b.event_type ?? 'n'} className="flex items-center justify-between text-sm">
                <Badge variant="outline">{b.event_type ?? 'unknown'}</Badge>
                <span className="font-mono">{b.n.toLocaleString()}</span>
              </div>
            ))}
            {(!health?.event_counts_24h || health.event_counts_24h.length === 0) && (
              <p className="text-sm text-muted-foreground">Aucune activité.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Actions admin récentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(recentAudit ?? []).slice(0, 10).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 text-xs border-b last:border-b-0 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{row.action}</div>
                <div className="text-muted-foreground truncate">
                  par {row.admin_email ?? row.admin_user_id?.slice(0, 8)}
                  {row.target_email ? ` → ${row.target_email}` : ''}
                  {row.target_key ? ` · ${row.target_key}` : ''}
                </div>
              </div>
              <span className="text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: fr })}
              </span>
            </div>
          ))}
          {(!recentAudit || recentAudit.length === 0) && (
            <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

const StatCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) => (
  <Card>
    <CardContent className="pt-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </CardContent>
  </Card>
);

function compact(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}
