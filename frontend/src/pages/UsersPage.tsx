import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/auth';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface UserWithCustomer extends User {
  customer?: { nomor_langganan: string; nama: string; alamat: string } | null;
}

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'klien',
  alamat: '', telepon: '', tarif_per_m3: '', meteran_awal: '',
};

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'admin';
  const endpoint = isAdmin ? '/admin/users' : '/operator/users';

  const [users, setUsers] = useState<UserWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserWithCustomer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(endpoint);
      setUsers(data.data ?? data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: isAdmin ? form.role : 'klien',
      };
      if (form.password) payload.password = form.password;
      if (payload.role === 'klien' || !isAdmin) {
        payload.alamat = form.alamat;
        payload.telepon = form.telepon;
        payload.tarif_per_m3 = parseFloat(form.tarif_per_m3);
        payload.meteran_awal = parseInt(form.meteran_awal);
      }

      if (editUser) {
        await api.put(`${endpoint}/${editUser.id}`, payload);
        toast({ title: 'User diperbarui' });
      } else {
        if (!payload.password) {
          toast({ title: 'Password wajib diisi', variant: 'destructive' });
          return;
        }
        await api.post(endpoint, payload);
        toast({ title: 'User berhasil dibuat' });
      }
      setShowForm(false);
      setEditUser(null);
      setForm(EMPTY_FORM);
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Terjadi kesalahan';
      toast({ title: 'Gagal', description: msg, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus user ini?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      toast({ title: 'User dihapus' });
      fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: 'Gagal hapus', description: msg, variant: 'destructive' });
    }
  };

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-red-500',
    operator: 'bg-blue-500',
    kasir: 'bg-yellow-500',
    klien: 'bg-green-500',
  };

  const openEdit = (u: UserWithCustomer) => {
    setEditUser(u);
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role, alamat: u.customer?.alamat ?? '',
      telepon: '', tarif_per_m3: '', meteran_awal: '',
    });
    setShowForm(true);
  };

  const showKlienFields = form.role === 'klien' || !isAdmin;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Kelola Akun {isAdmin ? '' : 'Klien'}
        </h1>
        <Button onClick={() => { setEditUser(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          + Tambah User
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>No. Langganan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge className={roleBadgeColor[u.role]}>{u.role}</Badge>
                </TableCell>
                <TableCell className="font-mono">{u.customer?.nomor_langganan ?? '-'}</TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(u.id)}>Hapus</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Tambah User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <Label>Password {editUser && '(kosongkan jika tidak diubah)'}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            {isAdmin && !editUser && (
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="kasir">Kasir</SelectItem>
                    <SelectItem value="klien">Klien</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showKlienFields && (
              <>
                <div>
                  <Label>Alamat</Label>
                  <Input value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))} />
                </div>
                <div>
                  <Label>Telepon</Label>
                  <Input value={form.telepon} onChange={e => setForm(f => ({ ...f, telepon: e.target.value }))} />
                </div>
                {!editUser && (
                  <>
                    <div>
                      <Label>Tarif per m³</Label>
                      <Input type="number" value={form.tarif_per_m3} onChange={e => setForm(f => ({ ...f, tarif_per_m3: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Meteran Awal</Label>
                      <Input type="number" value={form.meteran_awal} onChange={e => setForm(f => ({ ...f, meteran_awal: e.target.value }))} />
                    </div>
                  </>
                )}
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Batal</Button>
              <Button type="submit">{editUser ? 'Simpan' : 'Buat'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
