import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Receipt, User, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface ApiResponse {
  customer: {
    id: number;
    name: string;
    address: string;
    nomor_pelanggan: string;
    phone: string;
    status: string;
  };
  bill: {
    id: number;
    bulan: string;
    meteran_lama: number;
    meteran_baru: number;
    pemakaian: number;
    tarif_per_m3: number;
    jumlah_tagihan: number;
    tanggal_tagihan: string;
    jatuh_tempo: string;
    status: string;
  };
  amount: number;
  status: string;
}

interface TagihanData {
  nama: string;
  nomor_langganan: string;
  alamat: string;
  periode: string;
  meteran_awal: number;
  meteran_akhir: number;
  pemakaian: number;
  tarif_per_m3: number;
  jumlah_tagihan: number;
  tanggal_jatuh_tempo: string;
  status: string;
}

const formatRupiah = (angka: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('id-ID');
};

export const CheckBillPage: React.FC = () => {
  const navigate = useNavigate();
  const [nomorPelanggan, setNomorPelanggan] = useState('');
  const [dataTagihan, setDataTagihan] = useState<TagihanData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const cekTagihan = async () => {
    if (!nomorPelanggan.trim()) {
      toast({
        title: "Error",
        description: "Harap masukkan nomor pelanggan",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/kasir/cek-tagihan', {
        nomor_pelanggan: nomorPelanggan,
      });
      
      const apiData: ApiResponse = response.data;
      
      // Transform API response to match TagihanData interface
      const transformedData: TagihanData = {
        nama: apiData.customer.name,
        nomor_langganan: apiData.customer.nomor_pelanggan,
        alamat: apiData.customer.address,
        periode: apiData.bill.bulan,
        meteran_awal: apiData.bill.meteran_lama,
        meteran_akhir: apiData.bill.meteran_baru,
        pemakaian: apiData.bill.pemakaian,
        tarif_per_m3: apiData.bill.tarif_per_m3,
        jumlah_tagihan: apiData.bill.jumlah_tagihan,
        tanggal_jatuh_tempo: apiData.bill.jatuh_tempo,
        status: apiData.bill.status
      };
      
      setDataTagihan(transformedData);
      toast({
        title: "Berhasil",
        description: "Data tagihan berhasil ditemukan",
      });
    } catch (error: any) {
      setDataTagihan(null);
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Tagihan tidak ditemukan',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      cekTagihan();
    }
  };

  const resetForm = () => {
    setNomorPelanggan('');
    setDataTagihan(null);
  };

  const navigateToPayment = () => {
    if (!dataTagihan) return;
    
    // Simpan data tagihan ke localStorage untuk digunakan di halaman pembayaran
    localStorage.setItem('kasir_tagihan_data', JSON.stringify({
      nomor_pelanggan: nomorPelanggan,
      tagihan: dataTagihan
    }));
    
    // Navigasi ke halaman pembayaran
    navigate('/payments');
    
    toast({
      title: "Dialihkan ke Pembayaran",
      description: "Anda akan diarahkan ke halaman pembayaran",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Receipt className="h-8 w-8 text-gold" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cek Tagihan</h1>
          <p className="text-muted-foreground">Cek status tagihan pelanggan</p>
        </div>
      </div>

      {/* Search Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Pencarian Tagihan</CardTitle>
          <CardDescription>
            Masukkan nomor pelanggan untuk melihat tagihan yang belum dibayar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nomor_pelanggan">Nomor Pelanggan</Label>
            <div className="flex gap-2">
              <Input
                id="nomor_pelanggan"
                value={nomorPelanggan}
                onChange={(e) => setNomorPelanggan(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Masukkan nomor pelanggan (PLG001)"
                className="flex-1"
              />
              <Button
                onClick={cekTagihan}
                disabled={loading}
                className="bg-gradient-gold text-black hover:shadow-gold"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Cek Tagihan
              </Button>
            </div>
          </div>
          
          {dataTagihan && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={resetForm}>
                Reset Pencarian
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill Details */}
      {dataTagihan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-gold" />
                Informasi Pelanggan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nama:</span>
                  <span className="font-medium text-foreground">{dataTagihan.nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Pelanggan:</span>
                  <span className="font-medium text-foreground">{dataTagihan.nomor_langganan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alamat:</span>
                  <span className="font-medium text-foreground text-right max-w-[200px]">
                    {dataTagihan.alamat}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={dataTagihan.status === 'unpaid' ? 'destructive' : 'default'}>
                    {dataTagihan.status === 'unpaid' ? 'Belum Bayar' : 'Sudah Bayar'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bill Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gold" />
                Detail Tagihan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Periode:</span>
                  <span className="font-medium text-foreground">{dataTagihan.periode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meteran Awal:</span>
                  <span className="font-medium text-foreground">{dataTagihan.meteran_awal} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meteran Akhir:</span>
                  <span className="font-medium text-foreground">{dataTagihan.meteran_akhir} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pemakaian:</span>
                  <span className="font-medium text-blue-400">{dataTagihan.pemakaian} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarif per m³:</span>
                  <span className="font-medium text-foreground">{formatRupiah(dataTagihan.tarif_per_m3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jatuh Tempo:</span>
                  <span className="font-medium text-foreground">{formatDate(dataTagihan.tanggal_jatuh_tempo)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Summary */}
      {dataTagihan && (
        <Card className="border-gold bg-gradient-to-r from-brown-dark/50 to-gold/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gold">
              <DollarSign className="h-6 w-6" />
              Ringkasan Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tagihan</p>
                <p className="text-3xl font-bold text-gold">
                  {formatRupiah(dataTagihan.jumlah_tagihan)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {dataTagihan.pemakaian} m³ × {formatRupiah(dataTagihan.tarif_per_m3)}
                </p>
              </div>
              
              <div className="text-right">
                <Button 
                  size="lg"
                  className="bg-gradient-gold text-black hover:shadow-gold text-lg px-8 py-3"
                  onClick={navigateToPayment}
                >
                  <Receipt className="h-5 w-5 mr-2" />
                  Proses Pembayaran
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!dataTagihan && (
        <Card className="bg-blue-950/20 border-blue-400/20">
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <Receipt className="h-12 w-12 text-blue-400 mx-auto" />
              <h3 className="text-lg font-medium text-foreground">Cara Menggunakan</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Masukkan nomor pelanggan pada form di atas untuk mencari dan menampilkan detail tagihan yang belum dibayar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
