import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, UserMinus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/admin/components/AdminLayout';
import { AdminService } from '@/admin/services/AdminService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AdminRow {
  user_id: string;
  role: 'admin' | 'superadmin';
  notes: string | null;
  created_at: string;
}

export const AdminAdminsPage = () => {
  const qc = useQueryClient();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'superadmin'>('admin');
  const [notes, setNotes] = useState('');

  const { data: admins = [], isLoading } = useQuery<AdminRow[]>({
    queryKey: ['admins'],
    queryFn: async () => {
      const { data, error } = await db.from('admin_users').select('*').order('created_at');
      if (error) throw error;
      return data as AdminRow[];
    },
  });

  const addMutation = useMutation({
    mutationFn: () => AdminService.addAdmin(userId.trim(), role, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      setUserId(''); setNotes('');
      toast.success('Admin ajouté');
    },
    onError: (error: Error) => toast.error('Échec', { description: error.message }),
  });

  const removeMutation = useMutation({
    mutationFn: (targetId: string) => AdminService.removeAdmin(targetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admins'] });
      toast.success('Admin supprimé');
    },
    onError: (error: Error) => toast.error('Échec', { description: error.message }),
  });

  return (
    <AdminLayout
      title="Gestion des admins"
      subtitle="Superadmin uniquement. Chaque ajout/suppression est audité."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Ajouter un admin
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">User ID (UUID auth.users.id)</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
            </div>
            <div>
              <Label className="text-xs">Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'superadmin')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optionnel)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="dev principal / community manager / QA …" />
          </div>
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={!userId || addMutation.isPending}>
            <UserPlus className="h-4 w-4 mr-2" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Admins actuels</CardTitle></CardHeader>
        <CardContent className="p-0 divide-y">
          {admins.map((admin) => (
            <div key={admin.user_id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs">{admin.user_id}</code>
                  <Badge variant={admin.role === 'superadmin' ? 'default' : 'secondary'}>
                    {admin.role}
                  </Badge>
                </div>
                {admin.notes && <p className="text-xs text-muted-foreground mt-1">{admin.notes}</p>}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!confirm(`Supprimer l'admin ${admin.user_id} ?`)) return;
                  removeMutation.mutate(admin.user_id);
                }}
                disabled={removeMutation.isPending}
              >
                <UserMinus className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
          {admins.length === 0 && !isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun admin. Insérez manuellement la première ligne dans Supabase pour bootstrap.
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};
