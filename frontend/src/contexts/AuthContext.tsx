import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginRequest, AuthContextType, LoginResponse } from '@/types/auth';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const deriveMustChange = (u: User) =>
    u.role === 'klien' && u.password_changed_at === null;

  useEffect(() => {
    const storedToken = localStorage.getItem('water_billing_token');
    const storedUser  = localStorage.getItem('water_billing_user');

    if (storedToken && storedUser) {
      try {
        const parsed: User = JSON.parse(storedUser);
        if (parsed && parsed.id && parsed.role && parsed.name) {
          setToken(storedToken);
          setUser(parsed);
          setMustChangePassword(deriveMustChange(parsed));
        } else {
          localStorage.removeItem('water_billing_token');
          localStorage.removeItem('water_billing_user');
        }
      } catch {
        localStorage.removeItem('water_billing_token');
        localStorage.removeItem('water_billing_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      setIsLoading(true);
      const { data } = await api.post<LoginResponse>('/login', credentials);

      localStorage.setItem('water_billing_token', data.access_token);
      localStorage.setItem('water_billing_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setMustChangePassword(deriveMustChange(data.user));

      toast({
        title: 'Login Berhasil',
        description: `Selamat datang, ${data.user.name}!`,
      });
    } catch (error: unknown) {
      localStorage.removeItem('water_billing_token');
      localStorage.removeItem('water_billing_user');
      setToken(null);
      setUser(null);
      setMustChangePassword(false);
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Terjadi kesalahan saat login';
      toast({ title: 'Login Gagal', description: msg, variant: 'destructive' });
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch {
      // ignore logout API failure — always clear local state
    } finally {
      setUser(null);
      setToken(null);
      setMustChangePassword(false);
      localStorage.removeItem('water_billing_token');
      localStorage.removeItem('water_billing_user');
      toast({ title: 'Logout Berhasil', description: 'Anda telah berhasil keluar.' });
      window.location.href = '/login';
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const { data } = await api.get<User>('/user');
      setUser(data);
      setMustChangePassword(deriveMustChange(data));
      localStorage.setItem('water_billing_user', JSON.stringify(data));
    } catch {
      // ignore — keep existing state
    }
  };

  const value: AuthContextType = {
    user,
    token,
    mustChangePassword,
    login,
    logout,
    refreshUser,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
