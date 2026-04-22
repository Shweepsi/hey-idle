import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Save, AlertTriangle } from 'lucide-react';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { useAdminGlobalOverrides } from '@/admin/hooks/useAdminEconomy';
import type { GlobalOverrides } from '@/admin/types';

type MultiplierKey = keyof Pick<
  GlobalOverrides,
  'harvest_mult' | 'robot_mult' | 'xp_mult' | 'growth_mult' | 'essence_mult' | 'plant_cost_mult' | 'prestige_cost_mult'
>;

const MULTIPLIER_DEFS: Array<{ key: MultiplierKey; label: string; description: string; min: number; max: number; step: number }> = [
  { key: 'harvest_mult',      label: 'Multiplicateur de récolte',   description: 'Appliqué à la récompense finale.',     min: 0, max: 10, step: 0.05 },
  { key: 'robot_mult',        label: 'Multiplicateur du robot',     description: 'Pièces/min du robot.',                 min: 0, max: 10, step: 0.05 },
  { key: 'xp_mult',           label: 'Multiplicateur d\'XP',        description: 'Appliqué à chaque gain d\'XP.',        min: 0, max: 10, step: 0.05 },
  { key: 'growth_mult',       label: 'Vitesse de croissance',       description: 'Divise le temps de pousse.',           min: 0.1, max: 10, step: 0.05 },
  { key: 'essence_mult',      label: 'Multiplicateur d\'essence',   description: 'Essence gagnée au prestige.',          min: 0, max: 10, step: 0.05 },
  { key: 'plant_cost_mult',   label: 'Multiplicateur coût plantes', description: '1.0 = normal. 0.5 = plants à -50%.',   min: 0.1, max: 5, step: 0.05 },
  { key: 'prestige_cost_mult',label: 'Multiplicateur coût prestige',description: 'Pièces requises pour le prestige.',    min: 0.1, max: 5, step: 0.05 },
];

export const AdminEconomyPage = () => {
  const { overrides, isLoading, update, reset, isUpdating } = useAdminGlobalOverrides();
  const [draft, setDraft] = useState<GlobalOverrides | null>(null);

  useEffect(() => {
    if (overrides) setDraft(overrides);
  }, [overrides]);

  if (isLoading || !draft) {
    return (
      <AdminLayout title="Économie — Tuning en direct">
        <Card><CardContent className="py-8 text-center text-muted-foreground">Chargement…</CardContent></Card>
      </AdminLayout>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(overrides);

  const save = () => {
    if (!overrides) return;
    const patch: Partial<GlobalOverrides> = {};
    for (const k of Object.keys(draft) as Array<keyof GlobalOverrides>) {
      if (draft[k] !== overrides[k]) (patch as any)[k] = draft[k];
    }
    if (Object.keys(patch).length > 0) update(patch);
  };

  return (
    <AdminLayout
      title="Économie — Tuning en direct"
      subtitle="Les changements sont appliqués instantanément aux RPCs des joueurs."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => reset()} disabled={isUpdating}>
            <RotateCcw className="h-4 w-4 mr-2" /> Réinitialiser
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || isUpdating}>
            <Save className="h-4 w-4 mr-2" /> {dirty ? 'Enregistrer' : 'À jour'}
          </Button>
        </>
      }
    >
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Mode maintenance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Bloquer les RPCs économie</div>
              <p className="text-xs text-muted-foreground">Les récoltes, robots et plantations renverront une erreur aux joueurs. Utile pendant une migration.</p>
            </div>
            <Switch
              checked={draft.maintenance_mode}
              onCheckedChange={(v) => setDraft({ ...draft, maintenance_mode: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Message affiché (optionnel)</Label>
            <Input
              value={draft.maintenance_message ?? ''}
              onChange={(e) => setDraft({ ...draft, maintenance_message: e.target.value || null })}
              placeholder="ex. Mise à jour en cours, retour dans 10 min"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bannière d'événement</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">Nom</Label>
            <Input
              value={draft.event_name ?? ''}
              onChange={(e) => setDraft({ ...draft, event_name: e.target.value || null })}
              placeholder="ex. Week-end double XP"
            />
          </div>
          <div>
            <Label className="text-xs">Message bannière</Label>
            <Input
              value={draft.event_banner ?? ''}
              onChange={(e) => setDraft({ ...draft, event_banner: e.target.value || null })}
              placeholder="Affiché en haut du jeu"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Multiplicateurs globaux
            <Badge variant="outline" className="text-xs">Appliqués en dernier dans chaque RPC</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MULTIPLIER_DEFS.map(({ key, label, description, min, max, step }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Badge
                  variant={draft[key] === 1 ? 'secondary' : draft[key] > 1 ? 'default' : 'destructive'}
                  className="font-mono"
                >
                  ×{Number(draft[key]).toFixed(2)}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  value={[Number(draft[key])]}
                  min={min}
                  max={max}
                  step={step}
                  onValueChange={(val) => setDraft({ ...draft, [key]: val[0] })}
                  className="flex-1"
                />
                <Input
                  type="number"
                  className="w-24"
                  value={Number(draft[key])}
                  min={min}
                  max={max}
                  step={step}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n)) setDraft({ ...draft, [key]: n });
                  }}
                />
              </div>
            </div>
          ))}

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Bonus de chance de gemme (additif)</Label>
                <p className="text-xs text-muted-foreground">Ajouté à la probabilité de drop avant le cap 90%.</p>
              </div>
              <Badge variant="outline" className="font-mono">
                +{(draft.gem_chance_bonus * 100).toFixed(1)}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[draft.gem_chance_bonus]}
                min={0}
                max={0.5}
                step={0.005}
                onValueChange={(val) => setDraft({ ...draft, gem_chance_bonus: val[0] })}
                className="flex-1"
              />
              <Input
                type="number"
                className="w-24"
                value={draft.gem_chance_bonus}
                min={0}
                max={0.5}
                step={0.005}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isNaN(n)) setDraft({ ...draft, gem_chance_bonus: n });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};
