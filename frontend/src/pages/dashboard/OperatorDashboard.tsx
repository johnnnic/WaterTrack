import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Receipt,
  CreditCard,
  Droplets,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  Search,
  BarChart3,
  ClipboardEdit,
} from 'lucide-react';
import { DashboardStats, RecentActivity } from '@/lib/dashboard';

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

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Operator state
  const [nomorPelangganOperator, setNomorPelangganOperator] = useState('');
  const [meteranBaru, setMeteranBaru] = useState('');
  const [loadingCatatMeteran, setLoadingCatatMeteran] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [loadingCustomerInfo, setLoadingCustomerInfo] = useState(false);

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const statsResponse = await api.get('/admin/dashboard/stats');
      setStats(statsResponse.data);

      const activitiesResponse = await api.get('/admin/dashboard/activities');
      setRecentActivities(activitiesResponse.data);
    } catch (error) {
      console.error('Error fetching operator stats:', error);
      setStats(EMPTY_STATS);
      setRecentActivities([]);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const getCustomerInfo = async () => {
    if (!nomorPelangganOperator) {
      toast.warning('Nomor pelanggan harus diisi!');
      return;
    }

    setLoadingCustomerInfo(true);
    try {
      const res = await api.post('/operator/customer-info', {
        nomor_pelanggan: nomorPelangganOperator,
      });
      setCustomerInfo(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Pelanggan tidak ditemukan.');
      setCustomerInfo(null);
    } finally {
      setLoadingCustomerInfo(false);
    }
  };

  const catatMeteran = async () => {
    if (!nomorPelangganOperator || !meteranBaru) {
      toast.warning('Nomor pelanggan dan meteran baru harus diisi!');
      return;
    }

    setLoadingCatatMeteran(true);
    try {
      await api.post('/operator/catat-meteran', {
        nomor_pelanggan: nomorPelangganOperator,
        meteran_baru: parseInt(meteranBaru),
      });
      toast.success('Meteran berhasil dicatat!');
      setNomorPelangganOperator('');
      setMeteranBaru('');
      setCustomerInfo(null);
      fetchDashboardStats();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mencatat meteran!');
    } finally {
      setLoadingCatatMeteran(false);
    }
  };

  const roleStats = [
    { title: 'Total Pelanggan', value: stats.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-400' },
    { title: 'Pelanggan Aktif', value: stats.activeCustomers.toLocaleString(), icon: CheckCircle, color: 'text-green-400' },
    { title: 'Tagihan Bulan Ini', value: stats.monthlyBills.toLocaleString(), icon: Calendar, color: 'text-purple-400' },
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
        <h1 className="text-3xl font-bold text-foreground">Dashboard Operator</h1>
        <p className="text-muted-foreground">Kelola data pelanggan dan pencatatan meteran</p>
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
                {/* Catat Meteran Section */}
                <div className="space-y-4 p-4 bg-brown-dark/30 rounded-lg border border-brown-medium">
                  <h4 className="font-medium text-foreground flex items-center">
                    <BarChart3 className="h-4 w-4 mr-2" /> Catat Meteran
                  </h4>

                  {/* Customer Search */}
                  <div className="flex gap-2">
                    <Input
                      value={nomorPelangganOperator}
                      onChange={(e) => setNomorPelangganOperator(e.target.value)}
                      placeholder="Masukkan nomor pelanggan..."
                      className="flex-1 bg-input border-brown-medium focus:border-gold"
                    />
                    <Button
                      onClick={getCustomerInfo}
                      aria-label="Cari pelanggan"
                      className="px-4 bg-blue-600 text-white hover:bg-blue-700 transition-all border-0"
                      disabled={loadingCustomerInfo}
                    >
                      {loadingCustomerInfo ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
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
                      <label htmlFor="meteran-baru" className="text-sm text-foreground">Meteran Baru (m³)</label>
                      <Input
                        id="meteran-baru"
                        type="number"
                        value={meteranBaru}
                        onChange={(e) => setMeteranBaru(e.target.value)}
                        placeholder={`Minimal ${customerInfo.customer.meteran_terakhir} m³`}
                        min={customerInfo.customer.meteran_terakhir}
                        className="w-full bg-input border-brown-medium focus:border-gold"
                      />
                      <p className="text-xs text-muted-foreground">
                        Pemakaian akan dihitung: {meteranBaru ? (parseInt(meteranBaru) - customerInfo.customer.meteran_terakhir) : 0} m³
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  {customerInfo && (
                    <Button
                      onClick={catatMeteran}
                      className="w-full bg-gradient-gold text-black font-medium hover:shadow-gold transition-all transform hover:scale-105 border-0"
                      disabled={loadingCatatMeteran || !meteranBaru}
                    >
                      {loadingCatatMeteran ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Mencatat...</span>
                        </div>
                      ) : (
                        <><ClipboardEdit className="h-4 w-4 mr-2" />Catat Meteran</>
                      )}
                    </Button>
                  )}
                </div>

                {/* Quick Navigation */}
                <div className="grid grid-cols-1 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/customers')}
                    className="p-4 h-auto border-brown-medium bg-brown-dark text-foreground hover:bg-brown-medium transition-all justify-start"
                  >
                    <Users className="h-4 w-4 mr-2" /> Data Pelanggan
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
