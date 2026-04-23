import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCcw, TrendingUp, Users, Coins, Gem, Sparkles, Zap, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { useAdminHealth, useAdminGlobalOverrides } from '@/admin/hooks/useAdminEconomy';
import { useAdminAuditLog } from '@/admin/hooks/useAdminAudit';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCompact } from '@/lib/utils';

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
          value={formatCompact(t?.coins_earned_24h ?? 0)}
          sub={`${t?.harvests_24h ?? 0} récoltes`}
        />
        <StatCard
          icon={<Gem className="h-4 w-4 text-purple-600" />}
          label="Gemmes gagnées (24h)"
          value={formatCompact(t?.gems_earned_24h ?? 0)}
          sub={`${t?.active_boosts ?? 0} boosts actifs`}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4 text-pink-600" />}
          label="Essence gagnée (24h)"
          value={formatCompact(t?.essence_earned_24h ?? 0)}
          sub={`${t?.prestiges_24h ?? 0} prestiges`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Multiplicateurs actifs
            </span>
            <Link to="/admin/economy" className="text-xs font-normal text-muted-foreground hover:underline">Ajuster →</Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overrides ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <OverrideChip label="Récolte"   value={overrides.harvest_mult}   kind="mult" />
              <OverrideChip label="Robot"     value={overrides.robot_mult}     kind="mult" />
              <OverrideChip label="XP"        value={overrides.xp_mult}        kind="mult" />
              <OverrideChip label="Croiss."   value={overrides.growth_mult}    kind="mult" />
              <OverrideChip label="Essence"   value={overrides.essence_mult}   kind="mult" />
              <OverrideChip label="Coût plante"   value={overrides.plant_cost_mult}    kind="mult" />
              <OverrideChip label="Coût prestige" value={overrides.prestige_cost_mult}  kind="mult" />
              <OverrideChip label="Gem bonus" value={overrides.gem_chance_bonus} kind="add" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          )}
        </CardContent>
      </Card>

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

type ChipTone = 'neutral' | 'up' | 'down' | 'additive';

const TONE_CLASS: Record<ChipTone, string> = {
  neutral:  'border-muted bg-muted/30 text-muted-foreground',
  up:       'border-emerald-300 bg-emerald-50 text-emerald-900',
  down:     'border-red-300 bg-red-50 text-red-900',
  additive: 'border-amber-300 bg-amber-50 text-amber-900',
};

function chipTone(kind: 'mult' | 'add', value: number): ChipTone {
  if (kind === 'mult' && value === 1) return 'neutral';
  if (kind === 'add' && value === 0) return 'neutral';
  if (kind === 'mult' && value > 1) return 'up';
  if (kind === 'mult' && value < 1) return 'down';
  return 'additive';
}

const OverrideChip = ({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: 'mult' | 'add';
}) => {
  const formatted = kind === 'mult' ? `×${value.toFixed(2)}` : `+${(value * 100).toFixed(1)}%`;
  return (
    <div className={`rounded-md border px-2 py-1.5 ${TONE_CLASS[chipTone(kind, value)]}`}>
      <div className="text-muted-foreground/70">{label}</div>
      <div className="font-mono font-semibold">{formatted}</div>
    </div>
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

