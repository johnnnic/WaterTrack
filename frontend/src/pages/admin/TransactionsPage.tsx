import React, { useState, useEffect } from 'react';
import { Search, Eye, Download, Filter, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import ExcelJS from 'exceljs';

interface Payment {
  id: number;
  bill_id: number;
  user_id: number;
  jumlah_bayar: number;
  metode_pembayaran: string;
  keterangan: string;
  tanggal_bayar: string;
  created_at: string;
  updated_at: string;
  bill: {
    id: number;
    periode: string;
    customer: {
      id: number;
      id_klien: number;
      nama: string;
    };
  };
  user: {
    id: number;
    name: string;
    role: string;
  };
}

const formatRupiah = (angka: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('id-ID');
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID');
};

export const TransactionsPage: React.FC = () => {
  const { user } = useAuth();
  const apiBase = user?.role === 'kasir' ? '/kasir' : '/admin';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [metodePembayaranFilter, setMetodePembayaranFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const { toast } = useToast();
  const [apiStats, setApiStats] = useState({ total_payments: 0, today_payments: 0, total_amount: 0, today_amount: 0 });

  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Filter Modal State
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`${apiBase}/payments`);
      setPayments(response.data.data || response.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Gagal memuat data transaksi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get(`${apiBase}/payments/stats`);
      setApiStats(response.data);
    } catch {
      // silently fail — stats non-critical
    }
  };

  // Export Excel Function
  const exportToExcel = async () => {
    try {
      const exportData = filteredPayments.map((payment, index) => ({
        'No': index + 1,
        'Tanggal': formatDate(payment.tanggal_bayar),
        'Waktu': formatDateTime(payment.tanggal_bayar),
        'Nomor Pelanggan': `KLN-${payment.bill.customer.id_klien}`,
        'Nama Pelanggan': payment.bill.customer.nama,
        'Periode Tagihan': payment.bill.periode,
        'Jumlah Bayar': payment.jumlah_bayar,
        'Metode Pembayaran': payment.metode_pembayaran,
        'Kasir': payment.user.name,
        'Keterangan': payment.keterangan || '-',
      }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan Transaksi');
      worksheet.columns = [
        { header: 'No', key: 'No', width: 5 },
        { header: 'Tanggal', key: 'Tanggal', width: 12 },
        { header: 'Waktu', key: 'Waktu', width: 18 },
        { header: 'Nomor Pelanggan', key: 'Nomor Pelanggan', width: 15 },
        { header: 'Nama Pelanggan', key: 'Nama Pelanggan', width: 25 },
        { header: 'Periode Tagihan', key: 'Periode Tagihan', width: 12 },
        { header: 'Jumlah Bayar', key: 'Jumlah Bayar', width: 15 },
        { header: 'Metode Pembayaran', key: 'Metode Pembayaran', width: 15 },
        { header: 'Kasir', key: 'Kasir', width: 20 },
        { header: 'Keterangan', key: 'Keterangan', width: 25 },
      ];
      exportData.forEach(row => worksheet.addRow(row));

      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Laporan_Transaksi_${currentDate}.xlsx`;

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
        description: `Laporan berhasil diekspor ke file ${filename}`,
      });

    } catch {
      toast({
        title: "Error",
        description: "Gagal mengekspor laporan",
        variant: "destructive",
      });
    }
  };

  // Detail Modal Functions
  const openDetailModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedPayment(null);
  };

  // Print Receipt Function
  const printReceipt = (payment: Payment) => {
    const printContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
        <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0;">STRUK PEMBAYARAN</h2>
          <p style="margin: 5px 0;">SISTEM TAGIHAN AIR</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <p><strong>Tanggal:</strong> ${formatDateTime(payment.tanggal_bayar)}</p>
          <p><strong>ID Transaksi:</strong> TXN${payment.id.toString().padStart(6, '0')}</p>
        </div>
        
        <div style="border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
          <p><strong>Pelanggan:</strong> ${payment.bill.customer.nama}</p>
          <p><strong>No. Pelanggan:</strong> ${`KLN-${payment.bill.customer.id_klien}`}</p>
          <p><strong>Periode:</strong> ${payment.bill.periode}</p>
        </div>
        
        <div style="border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 10px;">
          <p><strong>Jumlah Bayar:</strong> ${formatRupiah(payment.jumlah_bayar)}</p>
          <p><strong>Metode:</strong> ${payment.metode_pembayaran}</p>
          <p><strong>Kasir:</strong> ${payment.user.name}</p>
        </div>
        
        ${payment.keterangan ? `<p><strong>Keterangan:</strong> ${payment.keterangan}</p>` : ''}
        
        <div style="text-align: center; margin-top: 20px; font-size: 12px;">
          <p>Terima kasih atas pembayaran Anda</p>
          <p>Simpan struk ini sebagai bukti pembayaran</p>
        </div>
      </div>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Filter Modal Functions
  const openFilterModal = () => {
    setFilterModalOpen(true);
  };

  const closeFilterModal = () => {
    setFilterModalOpen(false);
    // JANGAN reset startDate/endDate di sini
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const applyDateRangeFilter = () => {
    setFilterModalOpen(false);
    toast({
      title: "Filter Diterapkan",
      description: `Filter tanggal dari ${startDate} sampai ${endDate}`,
    });
  };

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, []);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.bill.customer.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `KLN-${payment.bill.customer.id_klien}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.bill.periode.includes(searchTerm) ||
      payment.user.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMetode = metodePembayaranFilter === 'all' || payment.metode_pembayaran === metodePembayaranFilter;
    
    let matchesDate = true;
    
    // Custom date range filter
    if (startDate && endDate) {
      const paymentDate = new Date(payment.tanggal_bayar);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      matchesDate = paymentDate >= start && paymentDate <= end;
    } else if (dateFilter !== 'all') {
      const today = new Date();
      const paymentDate = new Date(payment.tanggal_bayar);
      
      switch (dateFilter) {
        case 'today':
          matchesDate = paymentDate.toDateString() === today.toDateString();
          break;
        case 'this_week':
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = paymentDate >= weekAgo;
          break;
        case 'this_month':
          matchesDate = paymentDate.getMonth() === today.getMonth() && 
                       paymentDate.getFullYear() === today.getFullYear();
          break;
      }
    }
    
    return matchesSearch && matchesMetode && matchesDate;
  });

  // Get unique payment methods for filter
  const uniquePaymentMethods = [...new Set(payments.map(payment => payment.metode_pembayaran))];

  const stats = {
    total: payments.length,
    today: payments.filter(p => new Date(p.tanggal_bayar).toDateString() === new Date().toDateString()).length,
    totalAmount: payments.reduce((sum, p) => sum + p.jumlah_bayar, 0),
    todayAmount: payments
      .filter(p => new Date(p.tanggal_bayar).toDateString() === new Date().toDateString())
      .reduce((sum, p) => sum + p.jumlah_bayar, 0),
  };

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
          <h1 className="text-3xl font-bold text-foreground">Transaksi Pembayaran</h1>
          <p className="text-muted-foreground">Riwayat semua transaksi pembayaran tagihan</p>
        </div>
        <Button 
          variant="outline"
          className="gap-2"
          onClick={exportToExcel}
        >
          <Download className="h-4 w-4" />
          Export Laporan
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{apiStats.total_payments}</p>
              <p className="text-sm text-muted-foreground">Total Transaksi</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{apiStats.today_payments}</p>
              <p className="text-sm text-muted-foreground">Transaksi Hari Ini</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gold">{formatRupiah(apiStats.total_amount)}</p>
              <p className="text-sm text-muted-foreground">Total Nilai</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{formatRupiah(apiStats.today_amount)}</p>
              <p className="text-sm text-muted-foreground">Nilai Hari Ini</p>
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
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={metodePembayaranFilter} onValueChange={setMetodePembayaranFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Metode Pembayaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Metode</SelectItem>
                {uniquePaymentMethods.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Tanggal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tanggal</SelectItem>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="this_week">Minggu Ini</SelectItem>
                <SelectItem value="this_month">Bulan Ini</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={openFilterModal}
            >
              <Filter className="h-4 w-4" />
              Filter Lanjut
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Transaksi</CardTitle>
          <CardDescription>
            Menampilkan {filteredPayments.length} dari {payments.length} transaksi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Transaksi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>No. Pelanggan</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jumlah Bayar</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Kasir</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      #{payment.id.toString().padStart(6, '0')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(payment.tanggal_bayar)}</div>
                        <div className="text-muted-foreground text-xs">
                          {new Date(payment.tanggal_bayar).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{payment.bill.customer.nama}</TableCell>
                    <TableCell>{`KLN-${payment.bill.customer.id_klien}`}</TableCell>
                    <TableCell>{payment.bill.periode}</TableCell>
                    <TableCell className="font-medium text-gold">
                      {formatRupiah(payment.jumlah_bayar)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {payment.metode_pembayaran}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{payment.user.name}</div>
                        <div className="text-muted-foreground text-xs capitalize">
                          {payment.user.role}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailModal(payment)}
                          title="Lihat detail transaksi"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => printReceipt(payment)}
                          title="Cetak struk"
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
          
          {filteredPayments.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Tidak ada data transaksi</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Transaksi</DialogTitle>
            <DialogDescription>
              Informasi lengkap transaksi pembayaran
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">ID Transaksi</Label>
                  <p className="text-sm text-muted-foreground">TXN{selectedPayment.id.toString().padStart(6, '0')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tanggal & Waktu</Label>
                  <p className="text-sm text-muted-foreground">{formatDateTime(selectedPayment.tanggal_bayar)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Nama Pelanggan</Label>
                  <p className="text-sm text-muted-foreground">{selectedPayment.bill.customer.nama}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Nomor Pelanggan</Label>
                  <p className="text-sm text-muted-foreground">{`KLN-${selectedPayment.bill.customer.id_klien}`}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Periode Tagihan</Label>
                  <p className="text-sm text-muted-foreground">{selectedPayment.bill.periode}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Jumlah Bayar</Label>
                  <p className="text-lg font-bold text-foreground">{formatRupiah(selectedPayment.jumlah_bayar)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Metode Pembayaran</Label>
                  <p className="text-sm text-muted-foreground">{selectedPayment.metode_pembayaran}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Kasir</Label>
                  <p className="text-sm text-muted-foreground">{selectedPayment.user.name}</p>
                </div>
                {selectedPayment.keterangan && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">Keterangan</Label>
                    <p className="text-sm text-muted-foreground">{selectedPayment.keterangan}</p>
                  </div>
                )}
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
            {selectedPayment && (
              <Button
                onClick={() => printReceipt(selectedPayment)}
                className="bg-gradient-gold text-black hover:shadow-gold"
              >
                <Download className="h-4 w-4 mr-2" />
                Cetak Struk
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Modal */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filter Lanjutan</DialogTitle>
            <DialogDescription>
              Filter transaksi berdasarkan rentang tanggal
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Tanggal Mulai</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end_date">Tanggal Akhir</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { closeFilterModal(); clearDateFilter(); }}
            >
              Batal
            </Button>
            <Button
              onClick={applyDateRangeFilter}
              disabled={!startDate || !endDate}
              className="bg-gradient-gold text-black hover:shadow-gold"
            >
              <Filter className="h-4 w-4 mr-2" />
              Terapkan Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
