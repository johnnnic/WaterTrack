import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Download, Calendar, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import ExcelJS from 'exceljs';

interface Bill {
  id: number;
  customer_id: number;
  periode: string;
  meteran_awal: number;
  meteran_akhir: number;
  pemakaian: number;
  tarif_per_m3: number;
  jumlah_tagihan: number;
  status: 'belum_bayar' | 'sudah_bayar';
  tanggal_jatuh_tempo: string;
  created_at: string;
  updated_at: string;
  customer: {
    id: number;
    nomor_langganan: string;
    nama: string;
    alamat: string;
  };
}

interface Customer {
  id: number;
  nomor_langganan: string;
  nama: string;
  alamat: string;
  meteran_terakhir: number;
  tarif_per_m3: number;
}

interface GenerateBillForm {
  customer_id: number;
  periode: string;
  meteran_awal: number;
  meteran_akhir: number;
  tarif_per_m3: number;
  tanggal_jatuh_tempo: string;
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

export const BillsPage: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodeFilter, setPeriodeFilter] = useState<string>('all');
  const { toast } = useToast();

  // Generate Bill Modal State
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [generateForm, setGenerateForm] = useState<GenerateBillForm>({
    customer_id: 0,
    periode: '',
    meteran_awal: 0,
    meteran_akhir: 0,
    tarif_per_m3: 5000,
    tanggal_jatuh_tempo: '',
  });

  // Bill Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/admin/customers');
      setCustomers(response.data.data || response.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Gagal memuat data pelanggan",
        variant: "destructive",
      });
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/bills');
      const billsData = response.data.data || response.data;
      console.log('Bills data received:', billsData); // Debug log
      setBills(billsData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Gagal memuat data tagihan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate Bill Functions
  const openGenerateModal = async () => {
    await fetchCustomers();
    const currentDate = new Date();
    const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM format
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 25);
    
    setGenerateForm({
      customer_id: 0,
      periode: currentMonth,
      meteran_awal: 0,
      meteran_akhir: 0,
      tarif_per_m3: 5000,
      tanggal_jatuh_tempo: nextMonth.toISOString().split('T')[0],
    });
    setGenerateModalOpen(true);
  };

  const closeGenerateModal = () => {
    setGenerateModalOpen(false);
    setGenerateForm({
      customer_id: 0,
      periode: '',
      meteran_awal: 0,
      meteran_akhir: 0,
      tarif_per_m3: 5000,
      tanggal_jatuh_tempo: '',
    });
  };

  const handleGenerateInputChange = (field: keyof GenerateBillForm, value: string | number) => {
    setGenerateForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomerChange = (customerId: string) => {
    const selectedCustomer = customers.find(c => c.id === parseInt(customerId));
    if (selectedCustomer) {
      setGenerateForm(prev => ({
        ...prev,
        customer_id: selectedCustomer.id,
        meteran_awal: selectedCustomer.meteran_terakhir,
        tarif_per_m3: selectedCustomer.tarif_per_m3,
      }));
    }
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!generateForm.customer_id || !generateForm.periode || !generateForm.tanggal_jatuh_tempo) {
      toast({
        title: "Error",
        description: "Harap lengkapi semua field yang wajib diisi",
        variant: "destructive",
      });
      return;
    }

    if (generateForm.meteran_akhir <= generateForm.meteran_awal) {
      toast({
        title: "Error",
        description: "Meteran akhir harus lebih besar dari meteran awal",
        variant: "destructive",
      });
      return;
    }

    try {
      setGenerateLoading(true);
      
      await api.post('/admin/bills', generateForm);
      
      toast({
        title: "Berhasil",
        description: "Tagihan berhasil dibuat",
      });
      
      closeGenerateModal();
      fetchBills();
    } catch (error: any) {
      console.error('Error details:', error.response?.data);
      
      let errorMessage = "Gagal membuat tagihan";
      
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
      setGenerateLoading(false);
    }
  };

  // Bill Detail Functions
  const openDetailModal = (bill: Bill) => {
    setSelectedBill(bill);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedBill(null);
  };

  // Print Bill Function
  const printBill = (bill: Bill) => {
    // Simple print functionality - can be enhanced with proper bill template
    const printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>TAGIHAN AIR BERSIH</h2>
        <hr />
        <p><strong>Periode:</strong> ${bill.periode}</p>
        <p><strong>Nama Pelanggan:</strong> ${bill.customer.nama}</p>
        <p><strong>Nomor Pelanggan:</strong> ${bill.customer.nomor_langganan}</p>
        <p><strong>Alamat:</strong> ${bill.customer.alamat}</p>
        <hr />
        <p><strong>Meteran Awal:</strong> ${bill.meteran_awal} m³</p>
        <p><strong>Meteran Akhir:</strong> ${bill.meteran_akhir} m³</p>
        <p><strong>Pemakaian:</strong> ${bill.pemakaian} m³</p>
        <p><strong>Tarif per m³:</strong> ${formatRupiah(bill.tarif_per_m3)}</p>
        <hr />
        <p style="font-size: 18px;"><strong>TOTAL TAGIHAN: ${formatRupiah(bill.jumlah_tagihan)}</strong></p>
        <p><strong>Jatuh Tempo:</strong> ${formatDate(bill.tanggal_jatuh_tempo)}</p>
      </div>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Export Excel Function
  const exportToExcel = async () => {
    try {
      // Prepare data for export
      const exportData = filteredBills.map((bill, index) => ({
        'No': index + 1,
        'Periode': bill.periode,
        'Nomor Pelanggan': bill.customer.nomor_langganan,
        'Nama Pelanggan': bill.customer.nama,
        'Alamat': bill.customer.alamat,
        'Meteran Awal (m³)': bill.meteran_awal,
        'Meteran Akhir (m³)': bill.meteran_akhir,
        'Pemakaian (m³)': bill.pemakaian,
        'Tarif per m³': bill.tarif_per_m3,
        'Jumlah Tagihan': bill.jumlah_tagihan,
        'Status': bill.status === 'sudah_bayar' ? 'Sudah Bayar' : 'Belum Bayar',
        'Tanggal Jatuh Tempo': formatDate(bill.tanggal_jatuh_tempo),
        'Tanggal Dibuat': formatDate(bill.created_at),
      }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data Tagihan');
      worksheet.columns = [
        { header: 'No', key: 'No', width: 5 },
        { header: 'Periode', key: 'Periode', width: 10 },
        { header: 'Nomor Pelanggan', key: 'Nomor Pelanggan', width: 15 },
        { header: 'Nama Pelanggan', key: 'Nama Pelanggan', width: 25 },
        { header: 'Alamat', key: 'Alamat', width: 30 },
        { header: 'Meteran Awal (m³)', key: 'Meteran Awal (m³)', width: 12 },
        { header: 'Meteran Akhir (m³)', key: 'Meteran Akhir (m³)', width: 12 },
        { header: 'Pemakaian (m³)', key: 'Pemakaian (m³)', width: 12 },
        { header: 'Tarif per m³', key: 'Tarif per m³', width: 15 },
        { header: 'Jumlah Tagihan', key: 'Jumlah Tagihan', width: 15 },
        { header: 'Status', key: 'Status', width: 12 },
        { header: 'Tanggal Jatuh Tempo', key: 'Tanggal Jatuh Tempo', width: 18 },
        { header: 'Tanggal Dibuat', key: 'Tanggal Dibuat', width: 18 },
      ];
      exportData.forEach(row => worksheet.addRow(row));

      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Data_Tagihan_${currentDate}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Berhasil",
        description: `Data berhasil diekspor ke file ${filename}`,
      });

    } catch {
      toast({
        title: "Error",
        description: "Gagal mengekspor data ke Excel",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const filteredBills = bills.filter(bill => {
    const matchesSearch = 
      bill.customer.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.customer.nomor_langganan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.periode.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    const matchesPeriode = periodeFilter === 'all' || bill.periode === periodeFilter;
    
    return matchesSearch && matchesStatus && matchesPeriode;
  });

  // Get unique periods for filter
  const uniquePeriods = [...new Set(bills.map(bill => bill.periode))].sort().reverse();

  const stats = {
    total: bills.length,
    belumBayar: bills.filter(b => b.status === 'belum_bayar').length,
    sudahBayar: bills.filter(b => b.status === 'sudah_bayar').length,
    totalTagihan: bills.reduce((sum, b) => {
      const jumlah = Number(b.jumlah_tagihan) || 0;
      console.log(`Bill ${b.id}: jumlah_tagihan = ${b.jumlah_tagihan}, parsed = ${jumlah}`); // Debug log
      return sum + jumlah;
    }, 0),
  };

  console.log('Stats calculated:', stats); // Debug log

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
          <h1 className="text-3xl font-bold text-foreground">Kelola Tagihan</h1>
          <p className="text-muted-foreground">Manajemen tagihan bulanan pelanggan</p>
        </div>
        <Button 
          className="bg-gradient-gold text-black hover:shadow-gold"
          onClick={openGenerateModal}
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Tagihan
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Tagihan</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{stats.belumBayar}</p>
              <p className="text-sm text-muted-foreground">Belum Bayar</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{stats.sudahBayar}</p>
              <p className="text-sm text-muted-foreground">Sudah Bayar</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gold">{formatRupiah(stats.totalTagihan)}</p>
              <p className="text-sm text-muted-foreground">Total Nilai</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari pelanggan/periode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                <SelectItem value="sudah_bayar">Sudah Bayar</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={periodeFilter} onValueChange={setPeriodeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode</SelectItem>
                {uniquePeriods.map(periode => (
                  <SelectItem key={periode} value={periode}>{periode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={exportToExcel}
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Tagihan</CardTitle>
          <CardDescription>
            Menampilkan {filteredBills.length} dari {bills.length} tagihan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>No. Pelanggan</TableHead>
                  <TableHead>Pemakaian</TableHead>
                  <TableHead>Tarif/m³</TableHead>
                  <TableHead>Jumlah Tagihan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">
                      {bill.periode}
                    </TableCell>
                    <TableCell>{bill.customer.nama}</TableCell>
                    <TableCell>{bill.customer.nomor_langganan}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{bill.pemakaian} m³</div>
                        <div className="text-muted-foreground text-xs">
                          {bill.meteran_awal} → {bill.meteran_akhir}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatRupiah(bill.tarif_per_m3)}</TableCell>
                    <TableCell className="font-medium">
                      {formatRupiah(bill.jumlah_tagihan)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={bill.status === 'sudah_bayar' ? 'default' : 'destructive'}
                      >
                        {bill.status === 'sudah_bayar' ? 'Sudah Bayar' : 'Belum Bayar'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(bill.tanggal_jatuh_tempo)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailModal(bill)}
                          title="Lihat detail tagihan"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => printBill(bill)}
                          title="Cetak tagihan"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredBills.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Tidak ada data tagihan</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Bill Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Tagihan Baru</DialogTitle>
            <DialogDescription>
              Buat tagihan bulanan untuk pelanggan
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleGenerateSubmit} className="space-y-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Pilih Pelanggan <span className="text-red-400">*</span></Label>
              <Select
                value={generateForm.customer_id.toString()}
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pelanggan..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.nomor_langganan} - {customer.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Periode */}
            <div className="space-y-2">
              <Label htmlFor="generate_periode">
                Periode Tagihan <span className="text-red-400">*</span>
              </Label>
              <Input
                id="generate_periode"
                type="month"
                value={generateForm.periode}
                onChange={(e) => handleGenerateInputChange('periode', e.target.value)}
                required
              />
            </div>

            {/* Meteran Awal */}
            <div className="space-y-2">
              <Label htmlFor="generate_meteran_awal">Meteran Awal (m³)</Label>
              <Input
                id="generate_meteran_awal"
                type="number"
                value={generateForm.meteran_awal}
                onChange={(e) => handleGenerateInputChange('meteran_awal', parseInt(e.target.value) || 0)}
                min="0"
                readOnly
              />
            </div>

            {/* Meteran Akhir */}
            <div className="space-y-2">
              <Label htmlFor="generate_meteran_akhir">
                Meteran Akhir (m³) <span className="text-red-400">*</span>
              </Label>
              <Input
                id="generate_meteran_akhir"
                type="number"
                value={generateForm.meteran_akhir}
                onChange={(e) => handleGenerateInputChange('meteran_akhir', parseInt(e.target.value) || 0)}
                min={generateForm.meteran_awal}
                required
              />
            </div>

            {/* Tarif per m3 */}
            <div className="space-y-2">
              <Label htmlFor="generate_tarif_per_m3">Tarif per m³ (Rp)</Label>
              <Input
                id="generate_tarif_per_m3"
                type="number"
                value={generateForm.tarif_per_m3}
                onChange={(e) => handleGenerateInputChange('tarif_per_m3', parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>

            {/* Tanggal Jatuh Tempo */}
            <div className="space-y-2">
              <Label htmlFor="generate_tanggal_jatuh_tempo">
                Tanggal Jatuh Tempo <span className="text-red-400">*</span>
              </Label>
              <Input
                id="generate_tanggal_jatuh_tempo"
                type="date"
                value={generateForm.tanggal_jatuh_tempo}
                onChange={(e) => handleGenerateInputChange('tanggal_jatuh_tempo', e.target.value)}
                required
              />
            </div>

            {/* Preview Calculation */}
            {generateForm.meteran_akhir > generateForm.meteran_awal && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm">
                  <strong>Pemakaian:</strong> {generateForm.meteran_akhir - generateForm.meteran_awal} m³
                </p>
                <p className="text-sm">
                  <strong>Total Tagihan:</strong> {formatRupiah((generateForm.meteran_akhir - generateForm.meteran_awal) * generateForm.tarif_per_m3)}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeGenerateModal}
                disabled={generateLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={generateLoading}
                className="bg-gradient-gold text-black hover:shadow-gold"
              >
                {generateLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Generate Tagihan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bill Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Tagihan</DialogTitle>
            <DialogDescription>
              Informasi lengkap tagihan periode {selectedBill?.periode}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBill && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Nama Pelanggan</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.customer.nama}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Nomor Pelanggan</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.customer.nomor_langganan}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Alamat</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.customer.alamat}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Periode</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.periode}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Meteran Awal</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.meteran_awal} m³</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Meteran Akhir</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.meteran_akhir} m³</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Pemakaian</Label>
                  <p className="text-sm text-muted-foreground">{selectedBill.pemakaian} m³</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tarif per m³</Label>
                  <p className="text-sm text-muted-foreground">{formatRupiah(selectedBill.tarif_per_m3)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Tagihan</Label>
                  <p className="text-lg font-bold text-foreground">{formatRupiah(selectedBill.jumlah_tagihan)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <Badge variant={selectedBill.status === 'sudah_bayar' ? 'default' : 'destructive'}>
                      {selectedBill.status === 'sudah_bayar' ? 'Sudah Bayar' : 'Belum Bayar'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Jatuh Tempo</Label>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedBill.tanggal_jatuh_tempo)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Dibuat</Label>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedBill.created_at)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDetailModal}
            >
              Tutup
            </Button>
            {selectedBill && (
              <Button
                onClick={() => printBill(selectedBill)}
                className="bg-gradient-gold text-black hover:shadow-gold"
              >
                <Download className="h-4 w-4 mr-2" />
                Cetak Tagihan
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
