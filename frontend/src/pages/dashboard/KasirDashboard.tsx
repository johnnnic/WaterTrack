import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Receipt,
  CreditCard,
  TrendingUp,
  Droplets,
  AlertCircle,
  Clock,
  Search,
  CheckCircle2,
  X,
  FileText,
  Banknote,
  Printer,
} from 'lucide-react';
import { formatRupiah, DashboardStats, RecentActivity } from '@/lib/dashboard';

const EMPTY_STATS: DashboardStats = {
  totalCustomers: 0,
  activeCustomers: 0,
  totalBills: 0,
  monthlyBills: 0,
  totalPayments: 0,
  unpaidBills: 0,
  todayPayments: 0,
  todayPaymentsAmount: 0,
  monthlyPaymentsAmount: 0,
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'payment': return <CreditCard className="h-4 w-4 text-gold" />;
    case 'customer': return <Users className="h-4 w-4 text-blue-400" />;
    case 'bill': return <Receipt className="h-4 w-4 text-green-400" />;
    case 'meter': return <Droplets className="h-4 w-4 text-blue-500" />;
    default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

export const KasirDashboard: React.FC = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Kasir state
  const [nomorPelanggan, setNomorPelanggan] = useState('');
  const [dataTagihan, setDataTagihan] = useState<any | null>(null);
  const [loadingTagihan, setLoadingTagihan] = useState(false);
  const [metodePembayaran, setMetodePembayaran] = useState('tunai');
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [loadingBayar, setLoadingBayar] = useState(false);
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<any | null>(null);

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const statsResponse = await api.get('/admin/dashboard/stats');
      setStats({
        totalCustomers: 0,
        activeCustomers: 0,
        totalBills: 0,
        monthlyBills: 0,
        totalPayments: statsResponse.data.totalPayments || 0,
        unpaidBills: statsResponse.data.unpaidBills || 0,
        todayPayments: statsResponse.data.todayPayments || 0,
        todayPaymentsAmount: statsResponse.data.todayPaymentsAmount || 0,
        monthlyPaymentsAmount: statsResponse.data.monthlyPaymentsAmount || 0,
      });

      const activitiesResponse = await api.get('/admin/dashboard/activities');
      const paymentActivities = activitiesResponse.data.filter(
        (activity: any) => activity.type === 'payment'
      );
      setRecentActivities(paymentActivities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching kasir stats:', error);
      setStats(EMPTY_STATS);
      setRecentActivities([]);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const cekTagihan = async () => {
    if (!nomorPelanggan.trim()) {
      toast.warning('Nomor pelanggan harus diisi!');
      return;
    }

    setLoadingTagihan(true);
    try {
      const res = await api.post('/kasir/cek-tagihan', {
        nomor_pelanggan: nomorPelanggan.trim(),
      });
      setDataTagihan(res.data);
      setShowConfirmPayment(false);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Tagihan tidak ditemukan.';
      toast.error(errorMessage);
      setDataTagihan(null);
    } finally {
      setLoadingTagihan(false);
    }
  };

  const prosesBayar = async () => {
    if (!dataTagihan) {
      toast.warning('Tidak ada data tagihan!');
      return;
    }

    setLoadingBayar(true);
    try {
      const res = await api.post('/kasir/bayar', {
        nomor_pelanggan: nomorPelanggan,
        metode_pembayaran: metodePembayaran,
      });

      setLastPaymentReceipt({
        ...res.data,
        customer: dataTagihan.customer,
        bill: dataTagihan.bill,
        metode_pembayaran: metodePembayaran,
        tanggal_bayar: new Date().toLocaleString('id-ID'),
      });

      toast.success('Pembayaran berhasil diproses!');

      setDataTagihan(null);
      setNomorPelanggan('');
      setShowConfirmPayment(false);
      setMetodePembayaran('tunai');

      fetchDashboardStats();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Pembayaran gagal!';
      toast.error(errorMessage);
    } finally {
      setLoadingBayar(false);
    }
  };

  const escapeHtml = (str: string): string =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const printReceipt = () => {
    if (!lastPaymentReceipt) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHtml = `
      <html>
        <head>
          <title>Struk Pembayaran</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
            .separator { border-top: 1px dashed #000; margin: 10px 0; }
            .total { font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>WATER BILLING SYSTEM</h2>
            <p>Struk Pembayaran Tagihan Air</p>
          </div>
          <div class="separator"></div>
          <div class="row"><span>Nama:</span><span>${escapeHtml(lastPaymentReceipt.customer.name)}</span></div>
          <div class="row"><span>No. Pelanggan:</span><span>${escapeHtml(lastPaymentReceipt.customer.nomor_pelanggan)}</span></div>
          <div class="row"><span>Alamat:</span><span>${escapeHtml(lastPaymentReceipt.customer.address)}</span></div>
          <div class="separator"></div>
          <div class="row"><span>Bulan:</span><span>${escapeHtml(lastPaymentReceipt.bill.bulan)}</span></div>
          <div class="row"><span>Meteran Lama:</span><span>${lastPaymentReceipt.bill.meteran_lama} m³</span></div>
          <div class="row"><span>Meteran Baru:</span><span>${lastPaymentReceipt.bill.meteran_baru} m³</span></div>
          <div class="row"><span>Pemakaian:</span><span>${lastPaymentReceipt.bill.pemakaian} m³</span></div>
          <div class="row"><span>Tarif:</span><span>${formatRupiah(lastPaymentReceipt.bill.tarif_per_m3)}/m³</span></div>
          <div class="separator"></div>
          <div class="row total"><span>Total Bayar:</span><span>${formatRupiah(lastPaymentReceipt.jumlah_bayar)}</span></div>
          <div class="row"><span>Metode:</span><span>${escapeHtml(lastPaymentReceipt.metode_pembayaran)}</span></div>
          <div class="row"><span>Tanggal:</span><span>${escapeHtml(lastPaymentReceipt.tanggal_bayar)}</span></div>
          <div class="separator"></div>
          <div class="header">
            <p>Terima kasih atas pembayaran Anda</p>
            <p>ID: ${escapeHtml(lastPaymentReceipt.payment_id)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.print();
  };

  const roleStats = [
    { title: 'Pembayaran Hari Ini', value: stats.todayPayments.toLocaleString(), icon: CreditCard, color: 'text-gold' },
    { title: 'Total Hari Ini', value: formatRupiah(stats.todayPaymentsAmount), icon: Receipt, color: 'text-green-400' },
    { title: 'Total Bulan Ini', value: formatRupiah(stats.monthlyPaymentsAmount), icon: TrendingUp, color: 'text-blue-400' },
    { title: 'Tagihan Tertunda', value: stats.unpaidBills.toLocaleString(), icon: AlertCircle, color: 'text-red-400' },
  ];

  if (loadingStats) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-brown-medium" />
          <Skeleton className="h-4 w-80 bg-brown-medium" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 bg-brown-medium" />
            <Skeleton className="h-6 w-16 bg-brown-medium rounded-md" />
          </div>
        </div>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-brown-medium">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28 bg-brown-medium" />
                    <Skeleton className="h-8 w-20 bg-brown-medium" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg bg-brown-medium" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard Kasir</h1>
        <p className="text-muted-foreground">Proses pembayaran dan cek tagihan pelanggan</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Selamat datang,</span>
          <span className="font-medium text-gold">{user?.name}</span>
          <span className="px-2 py-1 text-xs bg-gold text-black rounded-md font-medium capitalize">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {roleStats.map((stat, statIndex) => (
          <Card key={`stat-${statIndex}-${stat.title}`} className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-soft hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-brown-dark ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activities & Aksi Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aktivitas Terbaru */}
        <Card className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-soft">
          <CardHeader>
            <CardTitle className="text-foreground">Aktivitas Terbaru</CardTitle>
            <CardDescription>Kegiatan sistem dalam 24 jam terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={`activity-${index}-${activity.id}`} className="flex items-center gap-4 p-3 rounded-lg bg-brown-dark/50 border border-brown-medium">
                    <div className="flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.customer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gold">{activity.amount}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Belum ada aktivitas terbaru</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Aksi Cepat */}
        <Card className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-soft">
          <CardHeader>
            <CardTitle className="text-foreground">Aksi Cepat</CardTitle>
            <CardDescription>Fitur yang sering digunakan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-4">
                {/* Input Section */}
                <div className="space-y-4 p-4 bg-brown-dark/30 rounded-lg border border-brown-medium">
                  <h4 className="font-medium text-foreground flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 inline" /> Cek &amp; Bayar Tagihan
                  </h4>

                  <div className="flex gap-2">
                    <Input
                      value={nomorPelanggan}
                      onChange={(e) => setNomorPelanggan(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && cekTagihan()}
                      placeholder="Masukkan nomor pelanggan (PLG001)"
                      className="flex-1 bg-input border-brown-medium focus:border-gold"
                    />
                    <Button
                      onClick={cekTagihan}
                      aria-label="Cek tagihan"
                      className="px-6 bg-gradient-gold text-black font-medium hover:shadow-gold transition-all border-0"
                      disabled={loadingTagihan}
                    >
                      {loadingTagihan ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Bill Information */}
                {dataTagihan && (
                  <div className="space-y-4 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-green-400 flex items-center">
                        <FileText className="h-4 w-4 mr-2" /> Detail Tagihan
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded ${dataTagihan?.status === 'paid' ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'}`}>
                        {dataTagihan?.status === 'paid' ? 'Lunas' : 'Belum Bayar'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">Nama: <span className="text-foreground font-medium">{dataTagihan?.customer?.name}</span></p>
                          <p className="text-muted-foreground">No. Pelanggan: <span className="text-foreground font-medium">{dataTagihan?.customer?.nomor_pelanggan}</span></p>
                          <p className="text-muted-foreground">Alamat: <span className="text-foreground">{dataTagihan?.customer?.address}</span></p>
                          {dataTagihan?.customer?.phone && (
                            <p className="text-muted-foreground">Telepon: <span className="text-foreground">{dataTagihan.customer.phone}</span></p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">Periode: <span className="text-foreground font-medium">{dataTagihan?.bill?.bulan}</span></p>
                        <p className="text-muted-foreground">Meteran Lama: <span className="text-foreground">{dataTagihan?.bill?.meteran_lama} m³</span></p>
                        <p className="text-muted-foreground">Meteran Baru: <span className="text-foreground">{dataTagihan?.bill?.meteran_baru} m³</span></p>
                        <p className="text-muted-foreground">Pemakaian: <span className="text-foreground font-medium">{dataTagihan?.bill?.pemakaian} m³</span></p>
                        <p className="text-muted-foreground">Tarif: <span className="text-foreground">{formatRupiah(dataTagihan?.bill?.tarif_per_m3)}/m³</span></p>
                      </div>
                    </div>

                    <div className="border-t border-green-600/30 pt-3">
                      <p className="text-lg font-bold text-gold">Total Tagihan: {formatRupiah(dataTagihan?.amount)}</p>
                      {dataTagihan?.bill?.jatuh_tempo && (
                        <p className="text-sm text-muted-foreground">Jatuh Tempo: {new Date(dataTagihan.bill.jatuh_tempo).toLocaleDateString('id-ID')}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Section */}
                {dataTagihan && dataTagihan?.status !== 'paid' && (
                  <div className="space-y-4 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                    <h4 className="font-medium text-blue-400 flex items-center">
                      <Banknote className="h-4 w-4 mr-2" /> Proses Pembayaran
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label htmlFor="metode-pembayaran" className="text-sm text-foreground mb-2 block">Metode Pembayaran</label>
                        <Select value={metodePembayaran} onValueChange={setMetodePembayaran}>
                          <SelectTrigger id="metode-pembayaran" className="w-full bg-input border-brown-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-brown-medium">
                            <SelectItem value="tunai">Tunai</SelectItem>
                            <SelectItem value="transfer">Transfer Bank</SelectItem>
                            <SelectItem value="kartu">Kartu Debit/Kredit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={() => setShowConfirmPayment(true)}
                          className="flex-1 bg-gradient-gold text-black font-medium hover:shadow-gold transition-all border-0"
                          disabled={loadingBayar}
                        >
                          <CreditCard className="h-4 w-4 mr-2" /> Bayar Sekarang
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            setDataTagihan(null);
                            setNomorPelanggan('');
                          }}
                          aria-label="Batalkan tagihan"
                          className="border-brown-medium px-4"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Confirmation Dialog */}
                <Dialog open={showConfirmPayment} onOpenChange={setShowConfirmPayment}>
                  <DialogContent className="bg-card border-brown-medium max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Konfirmasi Pembayaran</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">Pelanggan: <span className="text-foreground font-medium">{dataTagihan?.customer?.name}</span></p>
                      <p className="text-muted-foreground">Jumlah: <span className="text-gold font-bold">{dataTagihan ? formatRupiah(dataTagihan.amount) : '-'}</span></p>
                      <p className="text-muted-foreground">Metode: <span className="text-foreground font-medium capitalize">{metodePembayaran}</span></p>
                    </div>
                    <DialogFooter className="flex gap-3 mt-4">
                      <Button
                        onClick={prosesBayar}
                        disabled={loadingBayar}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white border-0"
                      >
                        {loadingBayar ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Memproses...</span>
                          </div>
                        ) : (
                          <><CheckCircle2 className="h-4 w-4 mr-2" />Konfirmasi</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowConfirmPayment(false)}
                        disabled={loadingBayar}
                        className="border-brown-medium"
                      >
                        <X className="h-4 w-4 mr-2" />Batal
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Last Payment Receipt */}
                {lastPaymentReceipt && (
                  <div className="space-y-4 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-green-400 flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Pembayaran Terakhir
                      </h4>
                      <Button
                        onClick={printReceipt}
                        className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 transition-all border-0 h-auto"
                      >
                        <Printer className="h-4 w-4 mr-2" /> Cetak Struk
                      </Button>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">ID: <span className="text-foreground font-mono">{lastPaymentReceipt.payment_id}</span></p>
                      <p className="text-muted-foreground">Pelanggan: <span className="text-foreground">{lastPaymentReceipt.customer?.name}</span></p>
                      <p className="text-muted-foreground">Jumlah: <span className="text-gold font-bold">{formatRupiah(lastPaymentReceipt.jumlah_bayar)}</span></p>
                      <p className="text-muted-foreground">Waktu: <span className="text-foreground">{lastPaymentReceipt.tanggal_bayar}</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
