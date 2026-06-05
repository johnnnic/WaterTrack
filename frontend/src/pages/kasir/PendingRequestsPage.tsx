import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface PendingBill {
  id: number;
  periode: string;
  jumlah_tagihan: number;
  requested_metode_pembayaran: string | null;
  customer: {
    nomor_langganan: string;
    nama: string;
  } | null;
}

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);

export const PendingRequestsPage = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<number | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/kasir/pending-requests');
      setBills(data.data ?? data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleConfirm = async (billId: number) => {
    setConfirming(billId);
    try {
      await api.put(`/kasir/bills/${billId}/confirm`, {});
      toast({ title: 'Pembayaran dikonfirmasi', description: 'Tagihan telah lunas.' });
      await fetchPending();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Terjadi kesalahan';
      toast({ title: 'Gagal', description: msg, variant: 'destructive' });
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Permintaan Pembayaran</h1>

      {loading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : bills.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Tidak ada permintaan pembayaran yang menunggu.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Langganan</TableHead>
              <TableHead>Nama Pelanggan</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Jumlah Tagihan</TableHead>
              <TableHead>Metode Pembayaran</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono">
                  {b.customer?.nomor_langganan ?? '-'}
                </TableCell>
                <TableCell>{b.customer?.nama ?? '-'}</TableCell>
                <TableCell>{b.periode}</TableCell>
                <TableCell>{idr(b.jumlah_tagihan)}</TableCell>
                <TableCell>
                  <Badge>{b.requested_metode_pembayaran ?? 'tunai'}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleConfirm(b.id)}
                    disabled={confirming === b.id}
                  >
                    {confirming === b.id ? 'Memproses...' : 'Konfirmasi Pembayaran'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
