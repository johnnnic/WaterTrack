import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Bill {
  id: number;
  periode: string;
  pemakaian: number;
  jumlah_tagihan: number;
  status: 'belum_bayar' | 'menunggu_konfirmasi' | 'sudah_bayar';
  tanggal_jatuh_tempo: string;
  requested_metode_pembayaran: string | null;
}

const STATUS_LABEL: Record<Bill['status'], string> = {
  belum_bayar: 'Belum Bayar',
  menunggu_konfirmasi: 'Menunggu Konfirmasi',
  sudah_bayar: 'Lunas',
};
const STATUS_COLOR: Record<Bill['status'], string> = {
  belum_bayar: 'bg-red-500',
  menunggu_konfirmasi: 'bg-yellow-500',
  sudah_bayar: 'bg-green-500',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n);

export const MyBillsPage = () => {
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [metode, setMetode] = useState('tunai');
  const [submitting, setSubmitting] = useState(false);

  const fetchBills = async () => {
    setLoading(true);
    const { data } = await api.get('/klien/bills');
    setBills(data.data ?? data);
    setLoading(false);
  };

  useEffect(() => { fetchBills(); }, []);

  const handleRequestPayment = async () => {
    if (!payBill) return;
    setSubmitting(true);
    try {
      await api.put(`/klien/bills/${payBill.id}/request-payment`, { metode_pembayaran: metode });
      toast({ title: 'Permintaan pembayaran diajukan' });
      setPayBill(null);
      fetchBills();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: 'Gagal', description: msg, variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handlePrintPdf = async (bill: Bill) => {
    const { data } = await api.get(`/klien/bills/${bill.id}/pdf`);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Struk WaterTrack</title>
      <style>body{font-family:sans-serif;padding:20px}</style></head><body>
      <h2>WaterTrack — Struk Tagihan</h2>
      <p>ID Klien: ${data.customer?.id_klien ? `KLN-${data.customer.id_klien}` : '-'}</p>
      <p>Nama: ${data.customer?.nama ?? '-'}</p>
      <p>Periode: ${data.periode}</p>
      <p>Pemakaian: ${data.pemakaian} m³</p>
      <p>Jumlah Tagihan: ${fmt(data.jumlah_tagihan)}</p>
      <p>Status: ${STATUS_LABEL[data.status as Bill['status']]}</p>
      <p>Jatuh Tempo: ${data.tanggal_jatuh_tempo}</p>
    </body></html>`);
    w.print();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Tagihan Saya</h1>

      {loading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Pemakaian</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map(b => (
              <TableRow key={b.id}>
                <TableCell>{b.periode}</TableCell>
                <TableCell>{b.pemakaian} m³</TableCell>
                <TableCell>{fmt(b.jumlah_tagihan)}</TableCell>
                <TableCell>{b.tanggal_jatuh_tempo}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLOR[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  {b.status === 'belum_bayar' && (
                    <Button size="sm" onClick={() => { setPayBill(b); setMetode('tunai'); }}>
                      Ajukan Bayar
                    </Button>
                  )}
                  {b.status === 'menunggu_konfirmasi' && (
                    <Button size="sm" disabled variant="outline">Menunggu Konfirmasi</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handlePrintPdf(b)}>
                    Unduh PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!payBill} onOpenChange={() => setPayBill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajukan Pembayaran</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Periode: {payBill?.periode}</p>
          <div>
            <p className="mb-2 font-medium">Pilih Metode Pembayaran</p>
            <Select value={metode} onValueChange={setMetode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tunai">Tunai</SelectItem>
                <SelectItem value="transfer">Transfer Bank</SelectItem>
                <SelectItem value="kartu">Kartu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPayBill(null)}>Batal</Button>
            <Button onClick={handleRequestPayment} disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Ajukan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
