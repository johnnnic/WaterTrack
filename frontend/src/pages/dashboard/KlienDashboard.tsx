import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, UserCircle } from 'lucide-react';

const KlienBanner: React.FC = () => {
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

export const KlienDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Selamat datang di sistem tagihan air</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Selamat datang,</span>
          <span className="font-medium text-gold">{user?.name}</span>
          <span className="px-2 py-1 text-xs bg-gold text-black rounded-md font-medium capitalize">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Klien notification banner */}
      <KlienBanner />

      {/* Aksi Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-soft">
          <CardHeader>
            <CardTitle className="text-foreground">Aksi Cepat</CardTitle>
            <CardDescription>Fitur yang sering digunakan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                className="w-full justify-start border-brown-medium hover:bg-brown-medium hover:text-gold"
                onClick={() => navigate('/my-bills')}
              >
                <FileText className="h-4 w-4 mr-2" />
                Lihat Tagihan Saya
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-brown-medium hover:bg-brown-medium hover:text-gold"
                onClick={() => navigate('/my-profile')}
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Profil Saya
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
