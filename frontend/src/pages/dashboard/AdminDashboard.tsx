import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
  Calendar,
  BarChart3,
  Settings,
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

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      setLoadingStats(true);
      const [statsResponse, activitiesResponse] = await Promise.all([
        api.get('/admin/dashboard/stats'),
        api.get('/admin/dashboard/activities'),
      ]);
      setStats(statsResponse.data);
      setRecentActivities(activitiesResponse.data);
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
      toast.error('Gagal memuat data dashboard.');
      setStats(EMPTY_STATS);
      setRecentActivities([]);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const roleStats = [
    { title: 'Total Pelanggan', value: stats.totalCustomers.toLocaleString(), icon: Users, color: 'text-blue-400' },
    { title: 'Pelanggan Aktif', value: stats.activeCustomers.toLocaleString(), icon: CheckCircle, color: 'text-green-400' },
    { title: 'Total Tagihan', value: stats.totalBills.toLocaleString(), icon: Receipt, color: 'text-purple-400' },
    { title: 'Tagihan Bulan Ini', value: stats.monthlyBills.toLocaleString(), icon: Calendar, color: 'text-indigo-400' },
    { title: 'Pembayaran Hari Ini', value: formatRupiah(stats.todayPaymentsAmount), icon: CreditCard, color: 'text-gold' },
    { title: 'Pendapatan Bulan Ini', value: formatRupiah(stats.monthlyPaymentsAmount), icon: TrendingUp, color: 'text-emerald-400' },
    { title: 'Belum Bayar', value: stats.unpaidBills.toLocaleString(), icon: AlertCircle, color: 'text-red-400' },
    { title: 'Total Transaksi', value: stats.totalPayments.toLocaleString(), icon: Receipt, color: 'text-cyan-400' },
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
          {Array.from({ length: 8 }).map((_, i) => (
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
        <h1 className="text-3xl font-bold text-foreground">Dashboard Administrator</h1>
        <p className="text-muted-foreground">Kelola semua aspek sistem tagihan air</p>
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
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/customers')}
                  className="p-4 h-auto border-brown-medium bg-brown-dark text-foreground hover:bg-brown-medium transition-all justify-start"
                >
                  <Users className="h-4 w-4 mr-2" /> Kelola Pelanggan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/transactions')}
                  className="p-4 h-auto border-brown-medium bg-brown-dark text-foreground hover:bg-brown-medium transition-all justify-start"
                >
                  <BarChart3 className="h-4 w-4 mr-2" /> Laporan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/bills')}
                  className="p-4 h-auto border-brown-medium bg-brown-dark text-foreground hover:bg-brown-medium transition-all justify-start"
                >
                  <Droplets className="h-4 w-4 mr-2" /> Generate Tagihan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/settings')}
                  className="p-4 h-auto border-brown-medium bg-brown-dark text-foreground hover:bg-brown-medium transition-all justify-start"
                >
                  <Settings className="h-4 w-4 mr-2" /> Pengaturan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
