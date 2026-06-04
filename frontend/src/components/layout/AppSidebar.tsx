import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  CreditCard, 
  Settings,
  LogOut,
  Droplets
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
import logo from '@/assets/logo.webp';

export const AppSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const getMenuItems = () => {
    const baseItems = [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard }
    ];

    switch (user?.role) {
      case 'admin':
        return [
          ...baseItems,
          { title: 'Kelola Pelanggan', url: '/customers', icon: Users },
          { title: 'Kelola Tagihan', url: '/bills', icon: Receipt },
          { title: 'Transaksi', url: '/transactions', icon: CreditCard },
          { title: 'Pengaturan', url: '/settings', icon: Settings },
        ];
      case 'operator':
        return [
          ...baseItems,
          { title: 'Kelola Pelanggan', url: '/customers', icon: Users },
        ];
      case 'kasir':
        return [
          ...baseItems,
          { title: 'Cek Tagihan', url: '/bills/check', icon: Receipt },
          { title: 'Pembayaran', url: '/payments', icon: CreditCard },
        ];
      default:
        return baseItems;
    }
  };

  const menuItems = getMenuItems();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="border-r border-brown-medium bg-sidebar">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <img 
              src={logo} 
              alt="Water Billing" 
              className="w-10 h-10 rounded-lg"
            />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-foreground">Water Billing</h1>
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
              {menuItems.map((item) => (
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