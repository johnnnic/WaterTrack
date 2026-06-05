import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

const KlienBanner = () => {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get('/klien/bills').then(({ data }) => {
      const bills = data.data ?? data;
      if (bills.length > 0) setStatus(bills[0].status);
    }).catch(() => {});
  }, []);

  if (!status || status === 'sudah_bayar') return null;

  if (status === 'menunggu_konfirmasi') {
    return (
      <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded mb-6">
        Permintaan pembayaran Anda sedang diproses kasir.
      </div>
    );
  }

  return (
    <div className="bg-red-100 border border-red-400 text-red-800 px-4 py-3 rounded mb-6 flex justify-between items-center">
      <span>Anda memiliki tagihan yang belum lunas. Segera ajukan pembayaran.</span>
      <a href="/my-bills" className="underline font-medium ml-4">Lihat Tagihan</a>
    </div>
  );
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Receipt,
  CreditCard,
  TrendingUp,
  Droplets,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar
} from 'lucide-react';

const formatRupiah = (angka: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
};

interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalBills: number;
  monthlyBills: number;
  totalPayments: number;
  unpaidBills: number;
  todayPayments: number;
  todayPaymentsAmount: number;
  monthlyPaymentsAmount: number;
}

interface RecentActivity {
  id: number;
  type: 'payment' | 'customer' | 'bill' | 'meter';
  action: string;
  customer: string;
  amount: string;
  time: string;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State untuk data dashboard
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    totalBills: 0,
    monthlyBills: 0,
    totalPayments: 0,
    unpaidBills: 0,
    todayPayments: 0,
    todayPaymentsAmount: 0,
    monthlyPaymentsAmount: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // State untuk kasir
  const [nomorPelanggan, setNomorPelanggan] = useState('');
  const [dataTagihan, setDataTagihan] = useState<any | null>(null);
  const [loadingTagihan, setLoadingTagihan] = useState(false);
  const [metodePembayaran, setMetodePembayaran] = useState('tunai');
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [loadingBayar, setLoadingBayar] = useState(false);
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<any | null>(null);

  // State untuk operator
  const [nomorPelangganOperator, setNomorPelangganOperator] = useState('');
  const [meteranBaru, setMeteranBaru] = useState('');
  const [loadingCatatMeteran, setLoadingCatatMeteran] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [loadingCustomerInfo, setLoadingCustomerInfo] = useState(false);

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      
      if (user?.role === 'admin') {
        // Fetch real data from API
        const [statsResponse, activitiesResponse] = await Promise.all([
          api.get('/admin/dashboard/stats'),
          api.get('/admin/dashboard/activities')
        ]);
        
        setStats(statsResponse.data);
        setRecentActivities(activitiesResponse.data);
        
      } else if (user?.role === 'kasir') {
        // For kasir, we can fetch limited stats or use specific kasir endpoints
        try {
          const statsResponse = await api.get('/admin/dashboard/stats');
          // Filter only relevant stats for kasir
          setStats({
            totalCustomers: 0, // Kasir doesn't need this
            activeCustomers: 0,
            totalBills: 0,
            monthlyBills: 0,
            totalPayments: statsResponse.data.totalPayments || 0,
            unpaidBills: statsResponse.data.unpaidBills || 0,
            todayPayments: statsResponse.data.todayPayments || 0,
            todayPaymentsAmount: statsResponse.data.todayPaymentsAmount || 0,
            monthlyPaymentsAmount: statsResponse.data.monthlyPaymentsAmount || 0,
          });
          
          // Get recent payment activities only
          const activitiesResponse = await api.get('/admin/dashboard/activities');
          const paymentActivities = activitiesResponse.data.filter((activity: any) => activity.type === 'payment');
          setRecentActivities(paymentActivities.slice(0, 10));
          
        } catch (error) {
          console.error('Error fetching kasir stats:', error);
          // Fallback to empty data
          setStats({
            totalCustomers: 0,
            activeCustomers: 0,
            totalBills: 0,
            monthlyBills: 0,
            totalPayments: 0,
            unpaidBills: 0,
            todayPayments: 0,
            todayPaymentsAmount: 0,
            monthlyPaymentsAmount: 0,
          });
          setRecentActivities([]);
        }
      } else {
        // For operator or other roles
        try {
          const statsResponse = await api.get('/admin/dashboard/stats');
          setStats(statsResponse.data);
          
          const activitiesResponse = await api.get('/admin/dashboard/activities');
          setRecentActivities(activitiesResponse.data);
        } catch (error) {
          console.error('Error fetching operator stats:', error);
          setStats({
            totalCustomers: 0,
            activeCustomers: 0,
            totalBills: 0,
            monthlyBills: 0,
            totalPayments: 0,
            unpaidBills: 0,
            todayPayments: 0,
            todayPaymentsAmount: 0,
            monthlyPaymentsAmount: 0,
          });
          setRecentActivities([]);
        }
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to empty data
      setStats({
        totalCustomers: 0,
        activeCustomers: 0,
        totalBills: 0,
        monthlyBills: 0,
        totalPayments: 0,
        unpaidBills: 0,
        todayPayments: 0,
        todayPaymentsAmount: 0,
        monthlyPaymentsAmount: 0,
      });
      setRecentActivities([]);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [user?.role]);

  const cekTagihan = async () => {
    if (!nomorPelanggan.trim()) {
      alert('Nomor pelanggan harus diisi!');
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
      alert(errorMessage);
      setDataTagihan(null);
    } finally {
      setLoadingTagihan(false);
    }
  };

  const prosesBayar = async () => {
    if (!dataTagihan) {
      alert('Tidak ada data tagihan!');
      return;
    }

    setLoadingBayar(true);
    try {
      const res = await api.post('/kasir/bayar', {
        nomor_pelanggan: nomorPelanggan,
        metode_pembayaran: metodePembayaran,
      });
      
      // Set receipt data
      setLastPaymentReceipt({
        ...res.data,
        customer: dataTagihan.customer,
        bill: dataTagihan.bill,
        metode_pembayaran: metodePembayaran,
        tanggal_bayar: new Date().toLocaleString('id-ID')
      });

      alert('Pembayaran berhasil diproses!');
      
      // Reset form
      setDataTagihan(null);
      setNomorPelanggan('');
      setShowConfirmPayment(false);
      setMetodePembayaran('tunai');
      
      // Refresh dashboard stats
      fetchDashboardStats();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || 'Pembayaran gagal!';
      alert(errorMessage);
    } finally {
      setLoadingBayar(false);
    }
  };

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
          <div class="row"><span>Nama:</span><span>${lastPaymentReceipt.customer.name}</span></div>
          <div class="row"><span>No. Pelanggan:</span><span>${lastPaymentReceipt.customer.nomor_pelanggan}</span></div>
          <div class="row"><span>Alamat:</span><span>${lastPaymentReceipt.customer.address}</span></div>
          <div class="separator"></div>
          <div class="row"><span>Bulan:</span><span>${lastPaymentReceipt.bill.bulan}</span></div>
          <div class="row"><span>Meteran Lama:</span><span>${lastPaymentReceipt.bill.meteran_lama} m³</span></div>
          <div class="row"><span>Meteran Baru:</span><span>${lastPaymentReceipt.bill.meteran_baru} m³</span></div>
          <div class="row"><span>Pemakaian:</span><span>${lastPaymentReceipt.bill.pemakaian} m³</span></div>
          <div class="row"><span>Tarif:</span><span>${formatRupiah(lastPaymentReceipt.bill.tarif_per_m3)}/m³</span></div>
          <div class="separator"></div>
          <div class="row total"><span>Total Bayar:</span><span>${formatRupiah(lastPaymentReceipt.jumlah_bayar)}</span></div>
          <div class="row"><span>Metode:</span><span>${lastPaymentReceipt.metode_pembayaran}</span></div>
          <div class="row"><span>Tanggal:</span><span>${lastPaymentReceipt.tanggal_bayar}</span></div>
          <div class="separator"></div>
          <div class="header">
            <p>Terima kasih atas pembayaran Anda</p>
            <p>ID: ${lastPaymentReceipt.payment_id}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.print();
  };

  // Fungsi untuk operator
  const getCustomerInfo = async () => {
    if (!nomorPelangganOperator) {
      alert('Nomor pelanggan harus diisi!');
      return;
    }

    setLoadingCustomerInfo(true);
    try {
      const res = await api.post('/operator/customer-info', {
        nomor_pelanggan: nomorPelangganOperator,
      });
      setCustomerInfo(res.data);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Pelanggan tidak ditemukan.');
      setCustomerInfo(null);
    } finally {
      setLoadingCustomerInfo(false);
    }
  };

  const catatMeteran = async () => {
    if (!nomorPelangganOperator || !meteranBaru) {
      alert('Nomor pelanggan dan meteran baru harus diisi!');
      return;
    }

    setLoadingCatatMeteran(true);
    try {
      await api.post('/operator/catat-meteran', {
        nomor_pelanggan: nomorPelangganOperator,
        meteran_baru: parseInt(meteranBaru),
      });
      alert('Meteran berhasil dicatat!');
      setNomorPelangganOperator('');
      setMeteranBaru('');
      setCustomerInfo(null);
      // Refresh stats after recording meter
      fetchDashboardStats();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Gagal mencatat meteran!');
    } finally {
      setLoadingCatatMeteran(false);
    }
  };

  const getRoleGreeting = () => {
    switch (user?.role) {
      case 'admin':
        return {
          title: 'Dashboard Administrator',
          description: 'Kelola semua aspek sistem tagihan air',
          stats: [
            { title: 'Total Pelanggan', value: stats.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-400' },
            { title: 'Pelanggan Aktif', value: stats.activeCustomers.toLocaleString(), icon: CheckCircle, color: 'text-green-400' },
            { title: 'Total Tagihan', value: stats.totalBills.toLocaleString(), icon: Receipt, color: 'text-purple-400' },
            { title: 'Tagihan Bulan Ini', value: stats.monthlyBills.toLocaleString(), icon: Calendar, color: 'text-indigo-400' },
            { title: 'Pembayaran Hari Ini', value: formatRupiah(stats.todayPaymentsAmount), icon: CreditCard, color: 'text-gold' },
            { title: 'Pendapatan Bulan Ini', value: formatRupiah(stats.monthlyPaymentsAmount), icon: TrendingUp, color: 'text-emerald-400' },
            { title: 'Belum Bayar', value: stats.unpaidBills.toLocaleString(), icon: AlertCircle, color: 'text-red-400' },
            { title: 'Total Transaksi', value: stats.totalPayments.toLocaleString(), icon: Receipt, color: 'text-cyan-400' },
          ]
        };
      case 'operator':
        return {
          title: 'Dashboard Operator',
          description: 'Kelola data pelanggan dan pencatatan meteran',
          stats: [
            { title: 'Total Pelanggan', value: stats.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-400' },
            { title: 'Pelanggan Aktif', value: stats.activeCustomers.toLocaleString(), icon: CheckCircle, color: 'text-green-400' },
            { title: 'Tagihan Bulan Ini', value: stats.monthlyBills.toLocaleString(), icon: Calendar, color: 'text-purple-400' },
            { title: 'Tagihan Tertunda', value: stats.unpaidBills.toLocaleString(), icon: AlertCircle, color: 'text-red-400' },
          ]
        };
      case 'kasir':
        return {
          title: 'Dashboard Kasir',
          description: 'Proses pembayaran dan cek tagihan pelanggan',
          stats: [
            { title: 'Pembayaran Hari Ini', value: stats.todayPayments.toLocaleString(), icon: CreditCard, color: 'text-gold' },
            { title: 'Total Hari Ini', value: formatRupiah(stats.todayPaymentsAmount), icon: Receipt, color: 'text-green-400' },
            { title: 'Total Bulan Ini', value: formatRupiah(stats.monthlyPaymentsAmount), icon: TrendingUp, color: 'text-blue-400' },
            { title: 'Tagihan Tertunda', value: stats.unpaidBills.toLocaleString(), icon: AlertCircle, color: 'text-red-400' },
          ]
        };
      default:
        return {
          title: 'Dashboard',
          description: 'Selamat datang di sistem tagihan air',
          stats: []
        };
    }
  };

  const { title, description, stats: roleStats } = getRoleGreeting();

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment': return <CreditCard className="h-4 w-4 text-gold" />;
      case 'customer': return <Users className="h-4 w-4 text-blue-400" />;
      case 'bill': return <Receipt className="h-4 w-4 text-green-400" />;
      case 'meter': return <Droplets className="h-4 w-4 text-blue-500" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {loadingStats ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Selamat datang,</span>
              <span className="font-medium text-gold">{user?.name}</span>
              <span className="px-2 py-1 text-xs bg-gold text-black rounded-md font-medium capitalize">
                {user?.role}
              </span>
            </div>
          </div>

          {/* Klien notification banner */}
          {user?.role === 'klien' && <KlienBanner />}

          {/* Stats Cards */}
          <div className={`grid gap-6 ${user?.role === 'admin' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'}`}>
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
            {/* Aktifitas */}
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

            {/* Quick Actions */}
            <Card className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-soft">
              <CardHeader>
                <CardTitle className="text-foreground">Aksi Cepat</CardTitle>
                <CardDescription>Fitur yang sering digunakan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  {user?.role === 'kasir' && (
                    <div className="space-y-4">
                      {/* Input Section */}
                      <div className="space-y-4 p-4 bg-brown-dark/30 rounded-lg border border-brown-medium">
                        <h4 className="font-medium text-foreground">💳 Cek & Bayar Tagihan</h4>
                        
                        <div className="flex gap-2">
                          <input
                            value={nomorPelanggan}
                            onChange={(e) => setNomorPelanggan(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && cekTagihan()}
                            className="flex-1 p-3 rounded-lg bg-input border border-brown-medium text-foreground"
                            placeholder="Masukkan nomor pelanggan (PLG001)"
                          />
                          <button
                            onClick={cekTagihan}
                            className="px-6 py-3 rounded-lg bg-gradient-gold text-black font-medium hover:shadow-gold transition-all"
                            disabled={loadingTagihan}
                          >
                            {loadingTagihan ? '⏳' : '🔍'}
                          </button>
                        </div>
                      </div>

                      {/* Bill Information */}
                      {dataTagihan && (
                        <div className="space-y-4 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium text-green-400">📋 Detail Tagihan</h4>
                            <span className={`px-2 py-1 text-xs rounded ${dataTagihan.status === 'paid' ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'}`}>
                              {dataTagihan.status === 'paid' ? 'Lunas' : 'Belum Bayar'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="space-y-1 text-sm">
                                <p className="text-muted-foreground">Nama: <span className="text-foreground font-medium">{dataTagihan.customer?.name}</span></p>
                                <p className="text-muted-foreground">No. Pelanggan: <span className="text-foreground font-medium">{dataTagihan.customer?.nomor_pelanggan}</span></p>
                                <p className="text-muted-foreground">Alamat: <span className="text-foreground">{dataTagihan.customer?.address}</span></p>
                                {dataTagihan.customer?.phone && (
                                  <p className="text-muted-foreground">Telepon: <span className="text-foreground">{dataTagihan.customer.phone}</span></p>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-1 text-sm">
                              <p className="text-muted-foreground">Periode: <span className="text-foreground font-medium">{dataTagihan.bill?.bulan}</span></p>
                              <p className="text-muted-foreground">Meteran Lama: <span className="text-foreground">{dataTagihan.bill?.meteran_lama} m³</span></p>
                              <p className="text-muted-foreground">Meteran Baru: <span className="text-foreground">{dataTagihan.bill?.meteran_baru} m³</span></p>
                              <p className="text-muted-foreground">Pemakaian: <span className="text-foreground font-medium">{dataTagihan.bill?.pemakaian} m³</span></p>
                              <p className="text-muted-foreground">Tarif: <span className="text-foreground">{formatRupiah(dataTagihan.bill?.tarif_per_m3)}/m³</span></p>
                            </div>
                          </div>
                          
                          <div className="border-t border-green-600/30 pt-3">
                            <p className="text-lg font-bold text-gold">Total Tagihan: {formatRupiah(dataTagihan.amount)}</p>
                            {dataTagihan.bill?.jatuh_tempo && (
                              <p className="text-sm text-muted-foreground">Jatuh Tempo: {new Date(dataTagihan.bill.jatuh_tempo).toLocaleDateString('id-ID')}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Payment Section */}
                      {dataTagihan && dataTagihan.status !== 'paid' && (
                        <div className="space-y-4 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                          <h4 className="font-medium text-blue-400">💰 Proses Pembayaran</h4>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm text-foreground mb-2 block">Metode Pembayaran</label>
                              <select
                                value={metodePembayaran}
                                onChange={(e) => setMetodePembayaran(e.target.value)}
                                className="w-full p-2 rounded-lg bg-input border border-brown-medium text-foreground"
                              >
                                <option value="tunai">💵 Tunai</option>
                                <option value="transfer">🏦 Transfer Bank</option>
                                <option value="kartu">💳 Kartu Debit/Kredit</option>
                              </select>
                            </div>
                            
                            <div className="flex gap-3">
                              <button
                                onClick={() => setShowConfirmPayment(true)}
                                className="flex-1 p-3 rounded-lg bg-gradient-gold text-black font-medium hover:shadow-gold transition-all"
                                disabled={loadingBayar}
                              >
                                💳 Bayar Sekarang
                              </button>
                              
                              <button
                                onClick={() => {
                                  setDataTagihan(null);
                                  setNomorPelanggan('');
                                }}
                                className="px-4 py-3 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-all"
                              >
                                ❌
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment Confirmation Modal */}
                      {showConfirmPayment && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                          <div className="bg-brown-dark p-6 rounded-lg border border-brown-medium max-w-md w-full mx-4">
                            <h3 className="text-lg font-bold text-foreground mb-4">Konfirmasi Pembayaran</h3>
                            <div className="space-y-2 text-sm mb-4">
                              <p className="text-muted-foreground">Pelanggan: <span className="text-foreground font-medium">{dataTagihan.customer?.name}</span></p>
                              <p className="text-muted-foreground">Jumlah: <span className="text-gold font-bold">{formatRupiah(dataTagihan.amount)}</span></p>
                              <p className="text-muted-foreground">Metode: <span className="text-foreground font-medium">{metodePembayaran}</span></p>
                            </div>
                            <div className="flex gap-3">
                              <button
                                onClick={prosesBayar}
                                className="flex-1 p-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-all"
                                disabled={loadingBayar}
                              >
                                {loadingBayar ? '⏳ Memproses...' : '✅ Konfirmasi'}
                              </button>
                              <button
                                onClick={() => setShowConfirmPayment(false)}
                                className="px-4 py-3 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-all"
                                disabled={loadingBayar}
                              >
                                ❌ Batal
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Last Payment Receipt */}
                      {lastPaymentReceipt && (
                        <div className="space-y-4 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium text-green-400">✅ Pembayaran Terakhir</h4>
                            <button
                              onClick={printReceipt}
                              className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
                            >
                              🖨️ Cetak Struk
                            </button>
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
                  )}

                  {user?.role === 'admin' && (
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => navigate('/customers')}
                        className="p-4 rounded-lg bg-brown-dark text-foreground border border-brown-medium hover:bg-brown-medium transition-all"
                      >
                        👥 Kelola Pelanggan
                      </button>
                      <button 
                        onClick={() => navigate('/transactions')}
                        className="p-4 rounded-lg bg-brown-dark text-foreground border border-brown-medium hover:bg-brown-medium transition-all"
                      >
                        📊 Laporan
                      </button>
                      <button 
                        onClick={() => navigate('/bills')}
                        className="p-4 rounded-lg bg-brown-dark text-foreground border border-brown-medium hover:bg-brown-medium transition-all"
                      >
                        💧 Generate Tagihan
                      </button>
                      <button 
                        onClick={() => navigate('/settings')}
                        className="p-4 rounded-lg bg-brown-dark text-foreground border border-brown-medium hover:bg-brown-medium transition-all"
                      >
                        ⚙️ Pengaturan
                      </button>
                    </div>
                  )}

                  {user?.role === 'operator' && (
                    <div className="space-y-4">
                      {/* Catat Meteran Section */}
                      <div className="space-y-4 p-4 bg-brown-dark/30 rounded-lg border border-brown-medium">
                        <h4 className="font-medium text-foreground">📊 Catat Meteran</h4>
                        
                        {/* Customer Search */}
                        <div className="flex gap-2">
                          <input
                            value={nomorPelangganOperator}
                            onChange={(e) => setNomorPelangganOperator(e.target.value)}
                            className="flex-1 p-2 rounded-lg bg-input border border-brown-medium text-foreground"
                            placeholder="Masukkan nomor pelanggan..."
                          />
                          <button
                            onClick={getCustomerInfo}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
                            disabled={loadingCustomerInfo}
                          >
                            {loadingCustomerInfo ? '⏳' : '🔍'}
                          </button>
                        </div>

                        {/* Customer Info Display */}
                        {customerInfo && (
                          <div className="p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
                            <h5 className="font-medium text-green-400 mb-2">Informasi Pelanggan</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              <p className="text-muted-foreground">Nama: <span className="text-foreground">{customerInfo.customer.name}</span></p>
                              <p className="text-muted-foreground">Alamat: <span className="text-foreground">{customerInfo.customer.address}</span></p>
                              <p className="text-muted-foreground">Meteran Terakhir: <span className="text-gold font-medium">{customerInfo.customer.meteran_terakhir} m³</span></p>
                              <p className="text-muted-foreground">Status: <span className="text-green-400">{customerInfo.customer.status}</span></p>
                            </div>
                          </div>
                        )}

                        {/* Meter Input */}
                        {customerInfo && (
                          <div className="space-y-2">
                            <label className="text-sm text-foreground">Meteran Baru (m³)</label>
                            <input
                              type="number"
                              value={meteranBaru}
                              onChange={(e) => setMeteranBaru(e.target.value)}
                              className="w-full p-2 rounded-lg bg-input border border-brown-medium text-foreground"
                              placeholder={`Minimal ${customerInfo.customer.meteran_terakhir} m³`}
                              min={customerInfo.customer.meteran_terakhir}
                            />
                            <p className="text-xs text-muted-foreground">
                              Pemakaian akan dihitung: {meteranBaru ? (parseInt(meteranBaru) - customerInfo.customer.meteran_terakhir) : 0} m³
                            </p>
                          </div>
                        )}

                        {/* Submit Button */}
                        {customerInfo && (
                          <button
                            onClick={catatMeteran}
                            className="w-full p-3 rounded-lg bg-gradient-gold text-black font-medium hover:shadow-gold transition-all transform hover:scale-105"
                            disabled={loadingCatatMeteran || !meteranBaru}
                          >
                            {loadingCatatMeteran ? '⏳ Mencatat...' : '📝 Catat Meteran'}
                          </button>
                        )}
                      </div>

                      {/* Quick Navigation */}
                      <div className="grid grid-cols-1 gap-4">
                        <button 
                          onClick={() => navigate('/customers')}
                          className="p-4 rounded-lg bg-brown-dark text-foreground border border-brown-medium hover:bg-brown-medium transition-all"
                        >
                          👥 Data Pelanggan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
