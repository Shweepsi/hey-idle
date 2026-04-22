import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, UserX, Coins, Gem, Sparkles } from 'lucide-react';
import { AdminLayout } from '@/admin/components/AdminLayout';
import {
  useAdminPlayerSearch,
  useAdminPlayerDetail,
  useAdminGrantCurrency,
  useAdminResetPlayer,
} from '@/admin/hooks/useAdminPlayers';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PlayerSearchRow } from '@/admin/types';

export const AdminPlayersPage = () => {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [selected, setSelected] = useState<PlayerSearchRow | null>(null);

  const { data: rows = [], isLoading } = useAdminPlayerSearch(activeQuery);

  return (
    <AdminLayout
      title="Joueurs"
      subtitle="Recherche, inspection, attribution de monnaie, reset."
      actions={
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setActiveQuery(query.trim());
          }}
        >
          <Input
            placeholder="email, nom, user-id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
          />
          <Button size="sm" type="submit" disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" /> Chercher
          </Button>
        </form>
      }
    >
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Joueur</th>
                  <th className="text-right p-3">Niveau</th>
                  <th className="text-right p-3">Prestige</th>
                  <th className="text-right p-3">Pièces</th>
                  <th className="text-right p-3">Gemmes</th>
                  <th className="text-right p-3">Essence</th>
                  <th className="text-right p-3">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.user_id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <td className="p-3">
                      <div className="font-medium truncate max-w-[260px]">
                        {row.display_name || row.email || row.user_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                        {row.email ?? row.user_id}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">{row.level}</td>
                    <td className="p-3 text-right">
                      <Badge variant="outline">P{row.prestige_level}</Badge>
                    </td>
                    <td className="p-3 text-right font-mono">{compact(row.coins)}</td>
                    <td className="p-3 text-right font-mono">{row.gems.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{compact(row.essence)}</td>
                    <td className="p-3 text-right text-xs text-muted-foreground">
                      {row.last_played
                        ? formatDistanceToNow(new Date(row.last_played), { addSuffix: true, locale: fr })
                        : '—'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Aucun joueur.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PlayerDetailDialog
        player={selected}
        onClose={() => setSelected(null)}
      />
    </AdminLayout>
  );
};

function compact(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

// -----------------------------------------------------------------------------
// Player detail + actions dialog
// -----------------------------------------------------------------------------
const PlayerDetailDialog = ({
  player,
  onClose,
}: {
  player: PlayerSearchRow | null;
  onClose: () => void;
}) => {
  const { data: detail } = useAdminPlayerDetail(player?.user_id ?? null);
  const grantMutation = useAdminGrantCurrency();
  const resetMutation = useAdminResetPlayer();

  const [grantCoins, setGrantCoins] = useState(0);
  const [grantGems, setGrantGems] = useState(0);
  const [grantEssence, setGrantEssence] = useState(0);
  const [grantReason, setGrantReason] = useState('');
  const [resetReason, setResetReason] = useState('');

  if (!player) return null;

  return (
    <Dialog open={!!player} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">
            {player.display_name || player.email || player.user_id}
          </DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{player.user_id}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <StatPill label="Niveau" value={player.level} />
          <StatPill label="Prestige" value={player.prestige_level} />
          <StatPill label="Pièces" value={compact(player.coins)} />
          <StatPill label="Gemmes" value={player.gems.toLocaleString()} />
          <StatPill label="Essence" value={compact(player.essence)} />
          <StatPill label="Récoltes" value={player.total_harvests.toLocaleString()} />
          <StatPill label="Créé" value={format(new Date(player.created_at), 'yyyy-MM-dd')} />
          <StatPill
            label="Actif"
            value={player.last_played ? formatDistanceToNow(new Date(player.last_played), { addSuffix: true, locale: fr }) : '—'}
          />
        </div>

        <Card className="mt-4">
          <CardContent className="pt-4 space-y-3">
            <Label className="text-sm font-semibold">Attribuer de la monnaie</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Pièces</Label>
                <Input type="number" value={grantCoins} onChange={(e) => setGrantCoins(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs">Gemmes</Label>
                <Input type="number" value={grantGems} onChange={(e) => setGrantGems(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs">Essence</Label>
                <Input type="number" value={grantEssence} onChange={(e) => setGrantEssence(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Raison (audit)</Label>
              <Input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder="compensation bug / événement / support ticket #123" />
            </div>
            <Button
              size="sm"
              disabled={grantMutation.isPending || (!grantCoins && !grantGems && !grantEssence) || !grantReason}
              onClick={() => {
                grantMutation.mutate({
                  userId: player.user_id,
                  coins: grantCoins,
                  gems: grantGems,
                  essence: grantEssence,
                  reason: grantReason,
                });
                setGrantCoins(0); setGrantGems(0); setGrantEssence(0); setGrantReason('');
              }}
            >
              <Coins className="h-4 w-4 mr-1" />
              <Gem className="h-4 w-4 mr-1" />
              <Sparkles className="h-4 w-4 mr-2" />
              Attribuer
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-3 border-red-200">
          <CardContent className="pt-4 space-y-3">
            <Label className="text-sm font-semibold text-red-700">Zone dangereuse</Label>
            <p className="text-xs text-muted-foreground">
              Réinitialise le joueur : toutes les pièces, gemmes, essence, améliorations,
              niveaux et parcelles reviennent à l'état initial. Destructif.
            </p>
            <Textarea
              placeholder="Raison (obligatoire pour l'audit log)"
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              className="min-h-[60px]"
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={resetMutation.isPending || !resetReason}
              onClick={() => {
                if (!confirm('Confirmer le reset complet de ce joueur ? Irréversible.')) return;
                resetMutation.mutate({ userId: player.user_id, reason: resetReason });
                setResetReason('');
              }}
            >
              <UserX className="h-4 w-4 mr-2" /> Réinitialiser le joueur
            </Button>
          </CardContent>
        </Card>

        {detail && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 text-xs">
            <div>
              <Label className="text-xs">Améliorations actives ({detail.upgrades?.length ?? 0})</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                {detail.upgrades?.filter((u) => u.active).map((u) => (
                  <div key={u.name} className="flex justify-between">
                    <span>{u.display_name}</span>
                    <span className="text-muted-foreground">{u.effect_type} ×{u.effect_value}</span>
                  </div>
                )) ?? <span className="text-muted-foreground">—</span>}
              </div>
            </div>
            <div>
              <Label className="text-xs">Essence upgrades ({detail.essence_upgrades?.length ?? 0})</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                {detail.essence_upgrades?.map((e) => (
                  <div key={e.upgrade_id} className="flex justify-between">
                    <span>{e.upgrade_id}</span>
                    <Badge variant="outline">Niv. {e.level}</Badge>
                  </div>
                )) ?? <span className="text-muted-foreground">—</span>}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Événements économiques récents ({detail.recent_events?.length ?? 0})</Label>
              <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1 font-mono">
                {detail.recent_events?.slice(0, 15).map((e, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>
                      <Badge variant="outline" className="mr-2">{e.event_type}</Badge>
                      {e.coins_delta !== 0 ? `🪙${compact(e.coins_delta)}` : ''}
                      {e.gems_delta !== 0 ? ` 💎${e.gems_delta}` : ''}
                      {e.essence_delta !== 0 ? ` ✨${compact(e.essence_delta)}` : ''}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                )) ?? <span className="text-muted-foreground">—</span>}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-md border bg-muted/30 px-2 py-1.5">
    <div className="text-muted-foreground">{label}</div>
    <div className="font-semibold truncate">{value}</div>
  </div>
);
