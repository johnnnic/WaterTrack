import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit, Trash2, Save, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface Customer {
  id: number;
  id_klien: number;
  nama: string;
  alamat: string;
  telepon: string;
  status: 'aktif' | 'nonaktif';
  tarif_per_m3: number;
  meteran_terakhir: number;
  tanggal_baca_terakhir: string;
  created_at: string;
  updated_at: string;
}

interface EditCustomerForm {
  nama: string;
  alamat: string;
  telepon: string;
  status: 'aktif' | 'nonaktif';
  tarif_per_m3: number;
  meteran_terakhir: number;
}

const formatRupiah = (angka: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID');
};

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const apiBase = isAdmin ? '/admin' : '/operator';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditCustomerForm>({
    nama: '',
    alamat: '',
    telepon: '',
    status: 'aktif',
    tarif_per_m3: 5000,
    meteran_terakhir: 0,
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      console.log('Fetching customers from API...');
      const response = await api.get(`${apiBase}/customers`);
      const customersData = response.data.data || response.data;
      console.log('Customers received:', customersData);
      setCustomers(customersData);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Gagal memuat data pelanggan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pelanggan ini?')) return;

    try {
      await api.delete(`/admin/customers/${id}`); // admin only
      toast({
        title: "Berhasil",
        description: "Pelanggan berhasil dihapus",
      });
      fetchCustomers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Gagal menghapus pelanggan",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditForm({
      nama: customer.nama,
      alamat: customer.alamat,
      telepon: customer.telepon || '',
      status: customer.status,
      tarif_per_m3: customer.tarif_per_m3,
      meteran_terakhir: customer.meteran_terakhir,
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingCustomer(null);
    setEditForm({
      nama: '',
      alamat: '',
      telepon: '',
      status: 'aktif',
      tarif_per_m3: 5000,
      meteran_terakhir: 0,
    });
  };

  const handleEditInputChange = (field: keyof EditCustomerForm, value: string | number) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCustomer) return;

    // Validation
    if (!editForm.nama || !editForm.alamat) {
      toast({
        title: "Error",
        description: "Harap lengkapi semua field yang wajib diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      setEditLoading(true);

      await api.put(`${apiBase}/customers/${editingCustomer.id}`, editForm);

      toast({
        title: "Berhasil",
        description: "Data pelanggan berhasil diperbarui",
      });

      closeEditModal();
      fetchCustomers();
    } catch (error: any) {
      console.error('Error details:', error.response?.data);

      let errorMessage = "Gagal memperbarui data pelanggan";

      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessages = Object.values(errors).flat();
        errorMessage = errorMessages.join(', ');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(customer.id_klien).includes(searchTerm) ||
    customer.alamat.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kelola Pelanggan</h1>
          <p className="text-muted-foreground">Manajemen data pelanggan sistem tagihan air</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Pelanggan hanya dapat ditambahkan melalui halaman <strong>Kelola Pengguna (Klien)</strong>.
        </span>
      </div>

      {/* Search & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari pelanggan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{customers.length}</p>
              <p className="text-sm text-muted-foreground">Total Pelanggan</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">
                {customers.filter(c => c.status === 'aktif').length}
              </p>
              <p className="text-sm text-muted-foreground">Pelanggan Aktif</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Pelanggan</CardTitle>
          <CardDescription>
            Total {filteredCustomers.length} pelanggan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Klien</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tarif/m³</TableHead>
                  <TableHead>Meteran Terakhir</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      KLN-{customer.id_klien}
                    </TableCell>
                    <TableCell>{customer.nama}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {customer.alamat}
                    </TableCell>
                    <TableCell>{customer.telepon || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={customer.status === 'aktif' ? 'default' : 'secondary'}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatRupiah(customer.tarif_per_m3)}</TableCell>
                    <TableCell>{customer.meteran_terakhir} m³</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(customer)}
                          title="Edit pelanggan"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCustomer(customer.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Hapus pelanggan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Tidak ada data pelanggan</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Customer Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pelanggan</DialogTitle>
            <DialogDescription>
              Perbarui data pelanggan {editingCustomer?.nama}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="edit_nama">
                Nama Lengkap <span className="text-red-400">*</span>
              </Label>
              <Input
                id="edit_nama"
                value={editForm.nama}
                onChange={(e) => handleEditInputChange('nama', e.target.value)}
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>

            {/* Alamat */}
            <div className="space-y-2">
              <Label htmlFor="edit_alamat">
                Alamat <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="edit_alamat"
                value={editForm.alamat}
                onChange={(e) => handleEditInputChange('alamat', e.target.value)}
                placeholder="Masukkan alamat lengkap"
                rows={3}
                required
              />
            </div>

            {/* Telepon */}
            <div className="space-y-2">
              <Label htmlFor="edit_telepon">Nomor Telepon</Label>
              <Input
                id="edit_telepon"
                type="tel"
                value={editForm.telepon}
                onChange={(e) => handleEditInputChange('telepon', e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status Pelanggan</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => handleEditInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="nonaktif">Non-aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tarif per m3 */}
            <div className="space-y-2">
              <Label htmlFor="edit_tarif_per_m3">Tarif per m³ (Rp)</Label>
              <Input
                id="edit_tarif_per_m3"
                type="number"
                value={editForm.tarif_per_m3}
                onChange={(e) => handleEditInputChange('tarif_per_m3', parseInt(e.target.value) || 0)}
                placeholder="5000"
                min="0"
              />
            </div>

            {/* Meteran Terakhir */}
            <div className="space-y-2">
              <Label htmlFor="edit_meteran_terakhir">Meteran Terakhir (m³)</Label>
              <Input
                id="edit_meteran_terakhir"
                type="number"
                value={editForm.meteran_terakhir}
                onChange={(e) => handleEditInputChange('meteran_terakhir', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeEditModal}
                disabled={editLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={editLoading}
                className="bg-gradient-gold text-black hover:shadow-gold"
              >
                {editLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
