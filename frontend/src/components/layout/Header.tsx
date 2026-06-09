import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user } = useAuth();

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'operator': return 'Operator';
      case 'kasir': return 'Kasir';
      case 'klien': return 'Pelanggan';
      default: return role;
    }
  };

  const routeTitles: Record<string, string> = {
    '/dashboard':              'Dashboard',
    '/users':                  'Kelola Akun',
    '/customers':              'Kelola Pelanggan',
    '/bills':                  'Kelola Tagihan',
    '/transactions':           'Transaksi',
    '/settings':               'Pengaturan',
    '/audit-logs':             'Audit Log',
    '/kasir/check':            'Cek Tagihan',
    '/payments':               'Proses Pembayaran',
    '/kasir/pending-requests': 'Permintaan Bayar',
    '/my-profile':             'Profil Saya',
    '/my-bills':               'Tagihan Saya',
  };

  const { pathname } = useLocation();
  const pageTitle = routeTitles[pathname] ?? 'WaterTrack';

  return (
    <header className="h-16 border-b border-brown-medium bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-foreground hover:text-gold" />
          <span className="text-sm font-semibold text-foreground hidden md:block">{pageTitle}</span>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" aria-label="Notifikasi">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </Button>

          <div className="flex items-center gap-3 px-3 py-2 bg-brown-dark rounded-lg border border-brown-medium">
            <div className="w-8 h-8 bg-gradient-gold rounded-full flex items-center justify-center">
              <span className="text-black font-semibold text-sm">
                {user?.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-gold">{getRoleDisplayName(user?.role || '')}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};