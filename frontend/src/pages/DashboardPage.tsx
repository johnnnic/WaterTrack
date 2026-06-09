import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard }    from './dashboard/AdminDashboard';
import { KasirDashboard }    from './dashboard/KasirDashboard';
import { OperatorDashboard } from './dashboard/OperatorDashboard';
import { KlienDashboard }    from './dashboard/KlienDashboard';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':    return <AdminDashboard />;
    case 'kasir':    return <KasirDashboard />;
    case 'operator': return <OperatorDashboard />;
    case 'klien':    return <KlienDashboard />;
    default:         return null;
  }
};
