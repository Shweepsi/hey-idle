import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Clock } from 'lucide-react';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { useAdminEvents } from '@/admin/hooks/useAdminEvents';
import type { AdminEventType } from '@/admin/types';
import { format } from 'date-fns';

const EVENT_TYPES: Array<{ value: AdminEventType; label: string }> = [
  { value: 'double_xp',      label: 'Double XP' },
  { value: 'double_coins',   label: 'Double pièces' },
  { value: 'double_gems',    label: 'Double gemmes' },
  { value: 'essence_boost',  label: 'Boost essence' },
  { value: 'growth_speed',   label: 'Vitesse de croissance' },
  { value: 'custom',         label: 'Personnalisé' },
];

export const AdminEventsPage = () => {
  const { events, isLoading, create, remove, isMutating } = useAdminEvents();

  const [name, setName] = useState('');
  const [type, setType] = useState<AdminEventType>('double_xp');
  const [mult, setMult] = useState(2);
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16));
  const [banner, setBanner] = useState('');

  const submit = () => {
    create({
      name,
      event_type: type,
      multiplier: mult,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      banner_message: banner || null,
    });
    setName(''); setBanner('');
  };

  return (
    <AdminLayout
      title="Événements planifiés"
      subtitle="Crée des événements à fenêtre temporelle. La logique d'application côté serveur se fait via le multiplicateur global_overrides correspondant."
    >
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Nouvel événement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Week-end double XP" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AdminEventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Multiplicateur</Label>
              <Input type="number" value={mult} step={0.1} min={0.1} max={10} onChange={(e) => setMult(Number(e.target.value) || 1)} />
            </div>
            <div>
              <Label className="text-xs">Début</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fin</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Bannière (optionnel)</Label>
              <Input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="Affiché en haut du jeu" />
            </div>
          </div>
          <Button size="sm" onClick={submit} disabled={isMutating || !name}>
            <Plus className="h-4 w-4 mr-2" />
            Créer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Événements actifs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {events.map((event) => {
            const now = Date.now();
            const start = new Date(event.starts_at).getTime();
            const end = new Date(event.ends_at).getTime();
            const status = now < start ? 'À venir' : now > end ? 'Terminé' : 'En cours';
            return (
              <div key={event.id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{event.name}</span>
                    <Badge variant="outline">{event.event_type}</Badge>
                    <Badge variant={status === 'En cours' ? 'default' : status === 'À venir' ? 'secondary' : 'outline'}>{status}</Badge>
                    <Badge variant="outline">×{event.multiplier}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(event.starts_at), 'yyyy-MM-dd HH:mm')} → {format(new Date(event.ends_at), 'yyyy-MM-dd HH:mm')}
                  </div>
                  {event.banner_message && (
                    <div className="text-xs text-muted-foreground mt-0.5 italic">"{event.banner_message}"</div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(event.id)} disabled={isMutating}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            );
          })}
          {events.length === 0 && !isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun événement planifié.
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};
