import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { useAdminFlags } from '@/admin/hooks/useAdminFlags';

export const AdminFlagsPage = () => {
  const { flags, isLoading, toggle, isUpdating } = useAdminFlags();

  return (
    <AdminLayout
      title="Feature flags"
      subtitle="Activation/désactivation live de fonctionnalités. Inclut un rollout progressif par bucket."
    >
      <Card>
        <CardContent className="p-0 divide-y">
          {flags.map((flag) => (
            <div key={flag.key} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm font-semibold">{flag.key}</code>
                  {flag.enabled ? (
                    <Badge variant="default">Actif</Badge>
                  ) : (
                    <Badge variant="secondary">Désactivé</Badge>
                  )}
                  <Badge variant="outline">{flag.rollout_percent}% rollout</Badge>
                </div>
                {flag.description && (
                  <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-36">
                  <Slider
                    value={[flag.rollout_percent]}
                    min={0}
                    max={100}
                    step={5}
                    disabled={!flag.enabled || isUpdating}
                    onValueChange={(v) => toggle({ key: flag.key, enabled: flag.enabled, rolloutPercent: v[0] })}
                  />
                </div>
                <Switch
                  checked={flag.enabled}
                  disabled={isUpdating}
                  onCheckedChange={(checked) => toggle({ key: flag.key, enabled: checked })}
                />
              </div>
            </div>
          ))}
          {flags.length === 0 && !isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun flag défini. Ajoutez-en via une migration ou une RPC custom.
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};
