import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="mb-6 animate-scale-in">
            <img
              src="/logo-watertrack.webp"
              alt="WaterTrack"
              className="mx-auto w-28 h-28 rounded-2xl shadow-elegant"
            />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Water Billing App</h1>
          <p className="text-muted-foreground">Sistem Manajemen Tagihan Air</p>
        </div>

        {/* Login Form */}
        <Card className="bg-card/50 backdrop-blur-sm border-brown-medium shadow-elegant animate-fade-in">
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
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
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

          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>&copy; 2026 Water Billing App. Semua hak dilindungi.</p>
        </div>
      </div>
    </div>
  );
};