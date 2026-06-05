import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Receipt,
  CreditCard,
  Settings,
  LogOut,
  Droplets,
  ClipboardList,
  Bell,
  UserCircle,
  FileText,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { WaterDropLogo } from '@/components/WaterDropLogo';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'operator', 'kasir', 'klien'] },
  { title: 'Kelola Akun', url: '/users', icon: Users, roles: ['admin', 'operator'] },
  { title: 'Kelola Pelanggan', url: '/customers', icon: Users, roles: ['admin', 'operator'] },
  { title: 'Kelola Tagihan', url: '/bills', icon: Receipt, roles: ['admin', 'operator'] },
  { title: 'Transaksi', url: '/transactions', icon: CreditCard, roles: ['admin', 'kasir'] },
  { title: 'Cek Tagihan', url: '/kasir/check', icon: Receipt, roles: ['admin', 'kasir'] },
  { title: 'Permintaan Bayar', url: '/kasir/pending-requests', icon: Bell, roles: ['kasir'] },
  { title: 'Audit Log', url: '/audit-logs', icon: ClipboardList, roles: ['admin'] },
  { title: 'Pengaturan', url: '/settings', icon: Settings, roles: ['admin'] },
  { title: 'Profil Saya', url: '/my-profile', icon: UserCircle, roles: ['klien'] },
  { title: 'Tagihan Saya', url: '/my-bills', icon: FileText, roles: ['klien'] },
] as const;

export const AppSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  type Role = typeof navItems[number]['roles'][number];
  const visibleItems = navItems.filter(item =>
    item.roles.includes(user?.role as Role)
  );

  return (
    <Sidebar className="border-r border-brown-medium bg-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <WaterDropLogo className="w-8 h-8" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-foreground">WaterTrack</h1>
              <p className="text-sm text-muted-foreground">Management App</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-gold font-medium">
            Menu Utama
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          isActive
                            ? 'bg-gold text-black font-medium shadow-gold'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="mb-4 p-3 bg-card rounded-lg border border-brown-medium">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-gold rounded-full flex items-center justify-center">
                <Droplets className="h-4 w-4 text-black" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        )}
        
        <Button
          variant="elegant"
          size={collapsed ? "icon" : "default"}
          onClick={logout}
          className="w-full"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};