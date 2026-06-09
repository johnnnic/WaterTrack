import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CustomerProfile {
  id_klien: number;
  nama: string;
  alamat: string;
  telepon: string;
  status: string;
  tarif_per_m3: number;
  meteran_terakhir: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);

export const MyProfilePage = () => {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    api.get('/klien/profile').then(({ data }) => setCustomer(data.customer));
  }, []);

  if (!customer) return <div className="p-6 text-muted-foreground">Memuat...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Profil Saya</h1>
      <Card>
        <CardHeader><CardTitle>Informasi Pelanggan</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-sm">ID Klien</p>
            <p className="font-mono font-bold text-gold">KLN-{customer.id_klien}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Nama</p>
            <p>{customer.nama}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Alamat</p>
            <p>{customer.alamat}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Telepon</p>
            <p>{customer.telepon || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Tarif per m³</p>
            <p>{fmt(customer.tarif_per_m3)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Meteran Terakhir</p>
            <p>{customer.meteran_terakhir} m³</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <p className={customer.status === 'aktif' ? 'text-green-500' : 'text-red-500'}>
              {customer.status}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
