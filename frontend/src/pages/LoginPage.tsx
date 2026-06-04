import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.webp';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, login } = useAuth();
  const location = useLocation();
  
  // Redirect if already logged in
  if (user) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login({ email, password });
    } catch (error) {
      // Error handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'Admin', email: 'admin@water.com', password: 'password' },
    { role: 'Operator', email: 'operator@water.com', password: 'password' },
    { role: 'Kasir', email: 'kasir@water.com', password: 'password' },
  ];

  const fillDemoAccount = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-gold rounded-2xl flex items-center justify-center mb-6 shadow-gold">
            <img 
              src={logo} 
              alt="Water Billing" 
              className="w-16 h-16 rounded-xl"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">WaterTrack</h1>
          <p className="text-muted-foreground">Sistem Manajemen Tagihan Air</p>
        </div>

        {/* Login Form */}
        <Card className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-elegant">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-foreground">Login ke Sistem</CardTitle>
            <CardDescription className="text-muted-foreground">
              Masukkan kredensial Anda untuk mengakses aplikasi
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-input border-brown-medium focus:border-gold focus:ring-gold"
                  placeholder="nama@email.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-input border-brown-medium focus:border-gold focus:ring-gold pr-10"
                    placeholder="Masukkan password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-gold transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    <span>Memproses...</span>
                  </div>
                ) : (
                  'Login'
                )}
              </Button>
            </form>

            {/* Demo Accounts */}
            <div className="pt-4 border-t border-brown-medium">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Akun Demo untuk Testing:
              </p>
              <div className="space-y-2">
                {demoAccounts.map((account) => (
                  <Button
                    key={account.role}
                    variant="minimal"
                    size="sm"
                    className="w-full text-left justify-start"
                    onClick={() => fillDemoAccount(account.email, account.password)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gradient-gold rounded-full flex items-center justify-center">
                        <Droplets className="h-3 w-3 text-black" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">{account.role}</p>
                        <p className="text-xs text-muted-foreground">{account.email}</p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>&copy; 2024 WaterTrack. Semua hak dilindungi.</p>
        </div>
      </div>
    </div>
  );
};