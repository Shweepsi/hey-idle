import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { useAdminAuditLog } from '@/admin/hooks/useAdminAudit';
import { format } from 'date-fns';

const ACTION_FILTERS = [
  { value: 'all',                     label: 'Toutes les actions' },
  { value: 'economy_config_update',   label: 'Config économie' },
  { value: 'economy_config_reset',    label: 'Reset config' },
  { value: 'grant_currency',          label: 'Attribution monnaie' },
  { value: 'reset_player',            label: 'Reset joueur' },
  { value: 'feature_flag_update',     label: 'Feature flag' },
  { value: 'event_create',            label: 'Création événement' },
  { value: 'event_delete',            label: 'Suppression événement' },
  { value: 'admin_add',               label: 'Ajout admin' },
  { value: 'admin_remove',            label: 'Suppression admin' },
];

export const AdminAuditPage = () => {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const limit = 50;

  const { data: rows = [], isLoading } = useAdminAuditLog(
    limit,
    offset,
    filter === 'all' ? null : filter,
  );

  return (
    <AdminLayout
      title="Audit log"
      subtitle="Chaque action admin est enregistrée ici — immuable."
      actions={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_FILTERS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Admin</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Cible</th>
                  <th className="text-left p-3">Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {row.admin_email ?? row.admin_user_id?.slice(0, 8)}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Badge variant="outline">{row.action}</Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap max-w-[220px] truncate">
                      {row.target_email ?? row.target_user_id ?? row.target_key ?? '—'}
                    </td>
                    <td className="p-3 font-mono text-[10px] max-w-sm whitespace-pre-wrap break-all">
                      {summarize(row)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Aucune entrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-3 border-t text-xs">
            <span className="text-muted-foreground">
              Page {Math.floor(offset / limit) + 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                Précédent
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rows.length < limit}
                onClick={() => setOffset((o) => o + limit)}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

function summarize(row: {
  action: string;
  before_value: unknown;
  after_value: unknown;
  meta: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  if (row.action === 'economy_config_update' && row.after_value && typeof row.after_value === 'object') {
    // Show changed keys only
    const before = (row.before_value ?? {}) as Record<string, unknown>;
    const after = row.after_value as Record<string, unknown>;
    const diff: string[] = [];
    for (const [k, v] of Object.entries(after)) {
      if (JSON.stringify(before[k]) !== JSON.stringify(v)) {
        diff.push(`${k}: ${JSON.stringify(before[k])} → ${JSON.stringify(v)}`);
      }
    }
    if (diff.length) parts.push(diff.join('\n'));
  } else if (row.action === 'grant_currency') {
    const m = row.meta ?? {};
    parts.push(`+${m.delta_coins ?? 0}🪙 +${m.delta_gems ?? 0}💎 +${m.delta_essence ?? 0}✨`);
    if (m.reason) parts.push(`Raison: ${m.reason}`);
  } else if (row.meta && Object.keys(row.meta).length) {
    parts.push(JSON.stringify(row.meta));
  }
  return parts.join('\n') || '—';
}
