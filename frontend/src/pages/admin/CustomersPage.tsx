import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Save, Loader2, Upload, Download, FileSpreadsheet } from 'lucide-react';
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
import ExcelJS from 'exceljs';

interface Customer {
  id: number;
  nomor_langganan: string;
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
  nomor_langganan: string;
  nama: string;
  alamat: string;
  telepon: string;
  status: 'aktif' | 'nonaktif';
  tarif_per_m3: number;
  meteran_terakhir: number;
}

interface ImportData {
  nomor_langganan: string;
  nama: string;
  alamat: string;
  telepon: string;
  status: 'aktif' | 'nonaktif';
  tarif_per_m3: number;
  meteran_terakhir: number;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<EditCustomerForm>({
    nomor_langganan: '',
    nama: '',
    alamat: '',
    telepon: '',
    status: 'aktif',
    tarif_per_m3: 5000,
    meteran_terakhir: 0,
  });

  // Add Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState<EditCustomerForm>({
    nomor_langganan: '',
    nama: '',
    alamat: '',
    telepon: '',
    status: 'aktif',
    tarif_per_m3: 5000,
    meteran_terakhir: 0,
  });

  // Import Excel State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importData, setImportData] = useState<ImportData[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching customers from API...');
      const response = await api.get('/admin/customers');
      const customersData = response.data.data || response.data;
      console.log('📊 Customers received:', customersData);
      setCustomers(customersData);
    } catch (error: any) {
      console.error('❌ Error fetching customers:', error);
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
      await api.delete(`/admin/customers/${id}`);
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
      nomor_langganan: customer.nomor_langganan,
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
      nomor_langganan: '',
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
    if (!editForm.nomor_langganan || !editForm.nama || !editForm.alamat) {
      toast({
        title: "Error",
        description: "Harap lengkapi semua field yang wajib diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      setEditLoading(true);
      
      await api.put(`/admin/customers/${editingCustomer.id}`, editForm);
      
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

  // Add Customer Functions
  const openAddModal = () => {
    setAddForm({
      nomor_langganan: '',
      nama: '',
      alamat: '',
      telepon: '',
      status: 'aktif',
      tarif_per_m3: 5000,
      meteran_terakhir: 0,
    });
    setAddModalOpen(true);
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setAddForm({
      nomor_langganan: '',
      nama: '',
      alamat: '',
      telepon: '',
      status: 'aktif',
      tarif_per_m3: 5000,
      meteran_terakhir: 0,
    });
  };

  const handleAddInputChange = (field: keyof EditCustomerForm, value: string | number) => {
    setAddForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!addForm.nomor_langganan || !addForm.nama || !addForm.alamat) {
      toast({
        title: "Error",
        description: "Harap lengkapi semua field yang wajib diisi",
        variant: "destructive",
      });
      return;
    }

    try {
      setAddLoading(true);
      console.log('Data yang akan dikirim:', addForm);
      
      const response = await api.post('/admin/customers', {
        ...addForm,
        tanggal_baca_terakhir: new Date().toISOString().split('T')[0]
      });
      
      toast({
        title: "Berhasil",
        description: "Pelanggan berhasil ditambahkan",
      });
      
      closeAddModal();
      fetchCustomers();
    } catch (error: any) {
      console.error('Error details:', error.response?.data);
      
      let errorMessage = "Gagal menambah pelanggan";
      
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
      setAddLoading(false);
    }
  };

  // Import Excel Functions
  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template Import Pelanggan');
    worksheet.columns = [
      { header: 'nomor_langganan', key: 'nomor_langganan', width: 20 },
      { header: 'nama', key: 'nama', width: 30 },
      { header: 'alamat', key: 'alamat', width: 35 },
      { header: 'telepon', key: 'telepon', width: 15 },
      { header: 'status', key: 'status', width: 10 },
      { header: 'tarif_per_m3', key: 'tarif_per_m3', width: 12 },
      { header: 'meteran_terakhir', key: 'meteran_terakhir', width: 16 },
    ];
    worksheet.addRow({ nomor_langganan: 'PLG001', nama: 'Contoh Nama Pelanggan', alamat: 'Jl. Contoh Alamat No. 123', telepon: '081234567890', status: 'aktif', tarif_per_m3: 5000, meteran_terakhir: 0 });
    worksheet.addRow({ nomor_langganan: 'PLG002', nama: 'Pelanggan Kedua', alamat: 'Jl. Alamat Kedua No. 456', telepon: '085678901234', status: 'aktif', tarif_per_m3: 7500, meteran_terakhir: 100 });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_pelanggan.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Template Excel berhasil diunduh",
    });
  };

  const validateImportData = (data: ImportData[]): ImportError[] => {
    const errors: ImportError[] = [];
    const existingNumbers = customers.map(c => c.nomor_langganan);

    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 karena row 1 adalah header

      // Validasi nomor langganan
      if (!row.nomor_langganan || row.nomor_langganan.trim() === '') {
        errors.push({ row: rowNum, field: 'nomor_langganan', message: 'Nomor langganan tidak boleh kosong' });
      } else if (existingNumbers.includes(row.nomor_langganan)) {
        errors.push({ row: rowNum, field: 'nomor_langganan', message: 'Nomor langganan sudah ada' });
      }

      // Validasi nama
      if (!row.nama || row.nama.trim() === '') {
        errors.push({ row: rowNum, field: 'nama', message: 'Nama tidak boleh kosong' });
      }

      // Validasi alamat
      if (!row.alamat || row.alamat.trim() === '') {
        errors.push({ row: rowNum, field: 'alamat', message: 'Alamat tidak boleh kosong' });
      }

      // Validasi status
      if (!row.status || !['aktif', 'nonaktif'].includes(row.status)) {
        errors.push({ row: rowNum, field: 'status', message: 'Status harus "aktif" atau "nonaktif"' });
      }

      // Validasi tarif per m3
      if (isNaN(row.tarif_per_m3) || row.tarif_per_m3 <= 0) {
        errors.push({ row: rowNum, field: 'tarif_per_m3', message: 'Tarif per m³ harus berupa angka positif' });
      }

      // Validasi meteran terakhir
      if (isNaN(row.meteran_terakhir) || row.meteran_terakhir < 0) {
        errors.push({ row: rowNum, field: 'meteran_terakhir', message: 'Meteran terakhir harus berupa angka tidak negatif' });
      }
    });

    return errors;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Error",
        description: "File harus berformat Excel (.xlsx atau .xls)",
        variant: "destructive",
      });
      return;
    }

    setImportFile(file);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const headers: string[] = [];
        const jsonData: Record<string, unknown>[] = [];
        let isHeader = true;

        worksheet.eachRow((row) => {
          if (isHeader) {
            row.eachCell((cell) => headers.push(String(cell.value ?? '')));
            isHeader = false;
          } else {
            const rowData: Record<string, unknown> = {};
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              rowData[headers[colNumber - 1]] = cell.value;
            });
            jsonData.push(rowData);
          }
        });

        // Transform data to match expected format
        const transformedData: ImportData[] = jsonData.map((row) => ({
          nomor_langganan: String(row.nomor_langganan || row['Nomor Langganan'] || ''),
          nama: String(row.nama || row.Nama || ''),
          alamat: String(row.alamat || row.Alamat || ''),
          telepon: String(row.telepon || row.Telepon || ''),
          status: (String(row.status || row.Status || 'aktif')).toLowerCase() as 'aktif' | 'nonaktif',
          tarif_per_m3: Number(row.tarif_per_m3 || row['Tarif per m3'] || row['Tarif per M3'] || 5000),
          meteran_terakhir: Number(row.meteran_terakhir || row['Meteran Terakhir'] || 0),
        }));

        const errors = validateImportData(transformedData);
        setImportData(transformedData);
        setImportErrors(errors);

        if (errors.length === 0) {
          toast({
            title: "File Valid",
            description: `${transformedData.length} data pelanggan siap diimport`,
          });
        } else {
          toast({
            title: "Terdapat Error",
            description: `${errors.length} error ditemukan. Periksa data Anda`,
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: "Error",
          description: "Gagal membaca file Excel",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processImport = async () => {
    if (importData.length === 0 || importErrors.length > 0) {
      toast({
        title: "Error",
        description: "Tidak ada data valid untuk diimport",
        variant: "destructive",
      });
      return;
    }

    setImportLoading(true);
    try {
      const response = await api.post('/admin/customers/import', {
        customers: importData
      });

      toast({
        title: "Import Berhasil",
        description: `${importData.length} pelanggan berhasil diimport`,
      });

      setImportData([]);
      setImportErrors([]);
      setImportFile(null);
      setImportModalOpen(false);
      await fetchCustomers();
    } catch (error: any) {
      
      toast({
        title: "Import Gagal",
        description: error.response?.data?.message || "Terjadi kesalahan saat import",
        variant: "destructive",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const resetImport = () => {
    setImportData([]);
    setImportErrors([]);
    setImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.nomor_langganan.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        <div className="flex gap-2">
          {(user?.role === 'operator' || user?.role === 'admin') && (
            <>
              <Button 
                variant="outline"
                onClick={downloadTemplate}
                className="border-gold text-gold hover:bg-gold hover:text-black"
              >
                <Download className="h-4 w-4 mr-2" />
                Template
              </Button>
              <Button 
                variant="outline"
                onClick={() => setImportModalOpen(true)}
                className="border-gold text-gold hover:bg-gold hover:text-black"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Excel
              </Button>
            </>
          )}
          <Button 
            className="bg-gradient-gold text-black hover:shadow-gold"
            onClick={openAddModal}
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Pelanggan
          </Button>
        </div>
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
                  <TableHead>No. Pelanggan</TableHead>
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
                      {customer.nomor_langganan}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCustomer(customer.id)}
                          className="text-red-400 hover:text-red-300"
                          title="Hapus pelanggan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
            {/* Nomor Pelanggan */}
            <div className="space-y-2">
              <Label htmlFor="edit_nomor_langganan">
                Nomor Pelanggan <span className="text-red-400">*</span>
              </Label>
              <Input
                id="edit_nomor_langganan"
                value={editForm.nomor_langganan}
                onChange={(e) => handleEditInputChange('nomor_langganan', e.target.value)}
                placeholder="PLG001"
                required
              />
            </div>

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

      {/* Add Customer Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Pelanggan Baru</DialogTitle>
            <DialogDescription>
              Masukkan data pelanggan baru yang akan ditambahkan ke sistem
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {/* Nomor Pelanggan */}
            <div className="space-y-2">
              <Label htmlFor="add_nomor_langganan">
                Nomor Pelanggan <span className="text-red-400">*</span>
              </Label>
              <Input
                id="add_nomor_langganan"
                value={addForm.nomor_langganan}
                onChange={(e) => handleAddInputChange('nomor_langganan', e.target.value)}
                placeholder="PLG001"
                required
              />
            </div>

            {/* Nama */}
            <div className="space-y-2">
              <Label htmlFor="add_nama">
                Nama Lengkap <span className="text-red-400">*</span>
              </Label>
              <Input
                id="add_nama"
                value={addForm.nama}
                onChange={(e) => handleAddInputChange('nama', e.target.value)}
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>

            {/* Alamat */}
            <div className="space-y-2">
              <Label htmlFor="add_alamat">
                Alamat <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="add_alamat"
                value={addForm.alamat}
                onChange={(e) => handleAddInputChange('alamat', e.target.value)}
                placeholder="Masukkan alamat lengkap"
                rows={3}
                required
              />
            </div>

            {/* Telepon */}
            <div className="space-y-2">
              <Label htmlFor="add_telepon">Nomor Telepon</Label>
              <Input
                id="add_telepon"
                type="tel"
                value={addForm.telepon}
                onChange={(e) => handleAddInputChange('telepon', e.target.value)}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status Pelanggan</Label>
              <Select
                value={addForm.status}
                onValueChange={(value) => handleAddInputChange('status', value)}
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
              <Label htmlFor="add_tarif_per_m3">Tarif per m³ (Rp)</Label>
              <Input
                id="add_tarif_per_m3"
                type="number"
                value={addForm.tarif_per_m3}
                onChange={(e) => handleAddInputChange('tarif_per_m3', parseInt(e.target.value) || 0)}
                placeholder="5000"
                min="0"
              />
            </div>

            {/* Meteran Terakhir */}
            <div className="space-y-2">
              <Label htmlFor="add_meteran_terakhir">Meteran Terakhir (m³)</Label>
              <Input
                id="add_meteran_terakhir"
                type="number"
                value={addForm.meteran_terakhir}
                onChange={(e) => handleAddInputChange('meteran_terakhir', parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeAddModal}
                disabled={addLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={addLoading}
                className="bg-gradient-gold text-black hover:shadow-gold"
              >
                {addLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Tambah Pelanggan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Excel Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-gold" />
              Import Data Pelanggan dari Excel
            </DialogTitle>
            <DialogDescription>
              Upload file Excel dengan format: nomor_langganan, nama, alamat, telepon, status, tarif_per_m3, meteran_terakhir
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="excel-file">Pilih File Excel</Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                File harus berformat .xlsx atau .xls dengan kolom: nomor_langganan, nama, alamat, telepon, status, tarif_per_m3, meteran_terakhir
              </p>
            </div>

            {/* Import Data Preview */}
            {importData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Preview Data ({importData.length} baris)</h4>
                  <Button variant="outline" size="sm" onClick={resetImport}>
                    Reset
                  </Button>
                </div>
                
                <div className="max-h-64 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nomor Langganan</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Alamat</TableHead>
                        <TableHead>Telepon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tarif/m³</TableHead>
                        <TableHead>Meteran Terakhir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.nomor_langganan}</TableCell>
                          <TableCell>{row.nama}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.alamat}</TableCell>
                          <TableCell>{row.telepon}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === 'aktif' ? 'default' : 'secondary'}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatRupiah(row.tarif_per_m3)}</TableCell>
                          <TableCell>{row.meteran_terakhir} m³</TableCell>
                        </TableRow>
                      ))}
                      {importData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            ... dan {importData.length - 10} data lainnya
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Import Errors */}
            {importErrors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">Error yang Ditemukan ({importErrors.length})</h4>
                <div className="max-h-40 overflow-auto bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  {importErrors.map((error, index) => (
                    <div key={index} className="text-sm text-destructive">
                      Baris {error.row}, Kolom {error.field}: {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportModalOpen(false);
                resetImport();
              }}
              disabled={importLoading}
            >
              Batal
            </Button>
            <Button
              onClick={processImport}
              disabled={importLoading || importData.length === 0 || importErrors.length > 0}
              className="bg-gradient-gold text-black hover:shadow-gold"
            >
              {importLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import {importData.length} Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
