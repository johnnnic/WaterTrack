import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, ArrowLeft, Receipt, CheckCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  pemakaian: number;
  tarif_per_m3: number;
  jumlah_tagihan: number;
  tanggal_jatuh_tempo: string;
}

interface PaymentForm {
  nomor_pelanggan: string;
  jumlah_bayar: number;
  metode_pembayaran: string;
  keterangan: string;
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

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'search' | 'payment' | 'success'>('search');
  const [loading, setLoading] = useState(false);
  const [nomorPelanggan, setNomorPelanggan] = useState('');
  const [dataTagihan, setDataTagihan] = useState<TagihanData | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    nomor_pelanggan: '',
    jumlah_bayar: 0,
    metode_pembayaran: 'tunai',
    keterangan: '',
  });

  const metodePembayaran = [
    { value: 'tunai', label: 'Tunai' },
    { value: 'transfer', label: 'Transfer Bank' },
    { value: 'kartu', label: 'Kartu Debit/Kredit' }
  ];

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
        pemakaian: apiData.bill.pemakaian,
        tarif_per_m3: apiData.bill.tarif_per_m3,
        jumlah_tagihan: apiData.bill.jumlah_tagihan,
        tanggal_jatuh_tempo: apiData.bill.jatuh_tempo
      };
      
      setDataTagihan(transformedData);
      setPaymentForm(prev => ({
        ...prev,
        nomor_pelanggan: nomorPelanggan,
        jumlah_bayar: transformedData.jumlah_tagihan,
      }));
      setStep('payment');
      
      toast({
        title: "Berhasil",
        description: "Data tagihan berhasil ditemukan",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Tagihan tidak ditemukan',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const prosesPembayaran = async () => {
    if (paymentForm.jumlah_bayar <= 0) {
      toast({
        title: "Error",
        description: "Jumlah pembayaran harus lebih dari 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/kasir/bayar', {
        nomor_pelanggan: paymentForm.nomor_pelanggan,
        metode_pembayaran: paymentForm.metode_pembayaran,
        keterangan: paymentForm.keterangan,
      });
      
      console.log('Payment response:', response.data);
      
      setStep('success');
      toast({
        title: "Pembayaran Berhasil!",
        description: "Tagihan telah berhasil dibayar",
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Pembayaran gagal',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('search');
    setNomorPelanggan('');
    setDataTagihan(null);
    setPaymentForm({
      nomor_pelanggan: '',
      jumlah_bayar: 0,
      metode_pembayaran: 'tunai',
      keterangan: '',
    });
  };

  // Check for data from CheckBillPage
  useEffect(() => {
    const storedData = localStorage.getItem('kasir_tagihan_data');
    if (storedData) {
      try {
        const { nomor_pelanggan, tagihan } = JSON.parse(storedData);
        
        // Set data tagihan
        setDataTagihan(tagihan);
        setNomorPelanggan(nomor_pelanggan);
        
        // Set payment form
        setPaymentForm(prev => ({
          ...prev,
          nomor_pelanggan: nomor_pelanggan,
          jumlah_bayar: tagihan.jumlah_tagihan,
        }));
        
        // Go directly to payment step
        setStep('payment');
        
        // Clear localStorage setelah digunakan
        localStorage.removeItem('kasir_tagihan_data');
        
        toast({
          title: "Data Tagihan Dimuat",
          description: "Data tagihan berhasil dimuat dari halaman cek tagihan",
        });
      } catch (error) {
        console.error('Error parsing stored tagihan data:', error);
        localStorage.removeItem('kasir_tagihan_data');
      }
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && step === 'search') {
      cekTagihan();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {step !== 'search' && (
          <Button
            variant="ghost"
            onClick={() => step === 'payment' ? setStep('search') : resetForm()}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <CreditCard className="h-8 w-8 text-gold" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {step === 'search' && 'Pembayaran Tagihan'}
            {step === 'payment' && 'Proses Pembayaran'}
            {step === 'success' && 'Pembayaran Berhasil'}
          </h1>
          <p className="text-muted-foreground">
            {step === 'search' && 'Cari dan bayar tagihan pelanggan'}
            {step === 'payment' && 'Konfirmasi pembayaran tagihan'}
            {step === 'success' && 'Transaksi telah berhasil diproses'}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4">
        <div className={`flex items-center space-x-2 ${step === 'search' ? 'text-gold' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'search' ? 'bg-gold text-black' : 'bg-muted text-muted-foreground'
          }`}>
            1
          </div>
          <span>Cari Tagihan</span>
        </div>
        
        <div className="w-12 h-px bg-muted"></div>
        
        <div className={`flex items-center space-x-2 ${step === 'payment' ? 'text-gold' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'payment' ? 'bg-gold text-black' : 'bg-muted text-muted-foreground'
          }`}>
            2
          </div>
          <span>Pembayaran</span>
        </div>
        
        <div className="w-12 h-px bg-muted"></div>
        
        <div className={`flex items-center space-x-2 ${step === 'success' ? 'text-green-400' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'success' ? 'bg-green-400 text-black' : 'bg-muted text-muted-foreground'
          }`}>
            <CheckCircle className="h-4 w-4" />
          </div>
          <span>Selesai</span>
        </div>
      </div>

      {/* Search Step */}
      {step === 'search' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Cari Tagihan Pelanggan</CardTitle>
            <CardDescription>
              Masukkan nomor pelanggan untuk memulai proses pembayaran
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
                    <Receipt className="h-4 w-4 mr-2" />
                  )}
                  Cari Tagihan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Step */}
      {step === 'payment' && dataTagihan && (
        <div className="space-y-6">
          {/* Bill Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Tagihan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama:</span>
                    <span className="font-medium">{dataTagihan.nama}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No. Pelanggan:</span>
                    <span className="font-medium">{dataTagihan.nomor_langganan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Periode:</span>
                    <span className="font-medium">{dataTagihan.periode}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pemakaian:</span>
                    <span className="font-medium">{dataTagihan.pemakaian} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarif/m³:</span>
                    <span className="font-medium">{formatRupiah(dataTagihan.tarif_per_m3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold text-gold text-lg">{formatRupiah(dataTagihan.jumlah_tagihan)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Detail Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jumlah_bayar">Jumlah Bayar</Label>
                  <Input
                    id="jumlah_bayar"
                    type="number"
                    value={paymentForm.jumlah_bayar}
                    onChange={(e) => setPaymentForm(prev => ({ 
                      ...prev, 
                      jumlah_bayar: parseInt(e.target.value) || 0 
                    }))}
                    min="0"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Metode Pembayaran</Label>
                  <Select
                    value={paymentForm.metode_pembayaran}
                    onValueChange={(value) => setPaymentForm(prev => ({ 
                      ...prev, 
                      metode_pembayaran: value 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metodePembayaran.map(metode => (
                        <SelectItem key={metode.value} value={metode.value}>
                          {metode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="keterangan">Keterangan (Opsional)</Label>
                <Textarea
                  id="keterangan"
                  value={paymentForm.keterangan}
                  onChange={(e) => setPaymentForm(prev => ({ 
                    ...prev, 
                    keterangan: e.target.value 
                  }))}
                  placeholder="Catatan tambahan..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total yang harus dibayar:</p>
                  <p className="text-2xl font-bold text-gold">{formatRupiah(dataTagihan.jumlah_tagihan)}</p>
                </div>
                
                <Button
                  onClick={prosesPembayaran}
                  disabled={loading}
                  size="lg"
                  className="bg-gradient-gold text-black hover:shadow-gold"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                  ) : (
                    <DollarSign className="h-4 w-4 mr-2" />
                  )}
                  Proses Pembayaran
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Step */}
      {step === 'success' && (
        <Card className="max-w-2xl mx-auto text-center">
          <CardContent className="p-8">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-black" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Pembayaran Berhasil!</h2>
                <p className="text-muted-foreground">
                  Tagihan untuk pelanggan <strong>{dataTagihan?.nama}</strong> telah berhasil dibayar
                </p>
              </div>
              
              <div className="bg-muted/20 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">No. Pelanggan:</p>
                    <p className="font-medium">{dataTagihan?.nomor_langganan}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Periode:</p>
                    <p className="font-medium">{dataTagihan?.periode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Jumlah Bayar:</p>
                    <p className="font-medium text-gold">{formatRupiah(paymentForm.jumlah_bayar)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Metode:</p>
                    <p className="font-medium capitalize">{paymentForm.metode_pembayaran}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 justify-center pt-4">
                <Button onClick={resetForm} className="bg-gradient-gold text-black hover:shadow-gold">
                  Pembayaran Baru
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Kembali ke Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
