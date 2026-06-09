import React, { useState } from 'react';
import { Gauge, Search, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerInfo {
  id: number;
  nomor_langganan: string;
  nama: string;
  alamat: string;
  meteran_terakhir: number;
  tarif_per_m3: number;
}

interface LatestBill {
  id: number;
  periode: string;
  status: string;
}

interface CustomerInfoResponse {
  customer: CustomerInfo;
  latest_bill: LatestBill | null;
}

interface SingleResult {
  bill_id: number;
  pemakaian: number;
  jumlah_tagihan: number;
  periode: string;
}

interface TemplateRow {
  id_klien: number;
  nama: string;
  meteran_terakhir: number;
  meteran_baru: number | null;
  sudah_dicatat: boolean;
}

interface BulkResult {
  berhasil: number;
  gagal: number;
  errors?: Array<{ id_klien: number; nama?: string; pesan: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currentPeriode = () => new Date().toISOString().slice(0, 7);

const formatRupiah = (angka: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);

// ─── Tab 1: Single ────────────────────────────────────────────────────────────

const SingleTab: React.FC = () => {
  const { toast } = useToast();

  const [idKlien, setIdKlien] = useState<string>('');
  const [meteranBaru, setMeteranBaru] = useState<string>('');
  const [periode, setPeriode] = useState<string>(currentPeriode());
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<string>('');

  const [customerInfo, setCustomerInfo] = useState<CustomerInfoResponse | null>(null);
  const [result, setResult] = useState<SingleResult | null>(null);
  const [loadingCari, setLoadingCari] = useState(false);
  const [loadingCatat, setLoadingCatat] = useState(false);

  const handleCariPelanggan = async () => {
    if (!idKlien) {
      toast({ title: 'Peringatan', description: 'ID Klien harus diisi.', variant: 'destructive' });
      return;
    }
    setLoadingCari(true);
    setCustomerInfo(null);
    setResult(null);
    try {
      const res = await api.post<CustomerInfoResponse>('/operator/customer-info', {
        id_klien: Number(idKlien),
      });
      setCustomerInfo(res.data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Pelanggan tidak ditemukan.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingCari(false);
    }
  };

  const handleCatatMeteran = async () => {
    if (!meteranBaru) {
      toast({ title: 'Peringatan', description: 'Meteran baru harus diisi.', variant: 'destructive' });
      return;
    }
    setLoadingCatat(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        id_klien: Number(idKlien),
        meteran_baru: Number(meteranBaru),
        periode,
      };
      if (tanggalJatuhTempo) payload.tanggal_jatuh_tempo = tanggalJatuhTempo;

      const res = await api.post<SingleResult>('/operator/catat-meteran', payload);
      setResult(res.data);
      toast({ title: 'Berhasil', description: 'Meteran berhasil dicatat.' });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Gagal mencatat meteran.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingCatat(false);
    }
  };

  const customer = customerInfo?.customer;

  return (
    <div className="space-y-6">
      {/* Row 1 — Cari Pelanggan */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="id-klien">ID Klien</Label>
        <div className="flex gap-2">
          <Input
            id="id-klien"
            type="number"
            placeholder="Contoh: 1"
            value={idKlien}
            onChange={(e) => setIdKlien(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            onClick={handleCariPelanggan}
            disabled={loadingCari}
          >
            {loadingCari ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Cari Pelanggan
          </Button>
        </div>
      </div>

      {/* Customer Info Card */}
      {customer && (
        <Card className="border border-brown-medium bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gold">Informasi Pelanggan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nama</span>
              <p className="font-medium text-foreground">{customer.nama}</p>
            </div>
            <div>
              <span className="text-muted-foreground">No. Langganan</span>
              <p className="font-medium text-foreground">{customer.nomor_langganan}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Alamat</span>
              <p className="font-medium text-foreground">{customer.alamat}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Meteran Terakhir</span>
              <p className="font-medium text-foreground">{customer.meteran_terakhir} m³</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 2 — Meteran Baru (hanya tampil setelah customer ditemukan) */}
      {customer && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="meteran-baru">Meteran Baru (m³)</Label>
          <Input
            id="meteran-baru"
            type="number"
            placeholder={`Min: ${customer.meteran_terakhir}`}
            min={customer.meteran_terakhir}
            value={meteranBaru}
            onChange={(e) => setMeteranBaru(e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}

      {/* Row 3 — Periode & Jatuh Tempo */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="periode">Periode (YYYY-MM)</Label>
          <Input
            id="periode"
            type="month"
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="jatuh-tempo">Jatuh Tempo</Label>
          <Input
            id="jatuh-tempo"
            type="date"
            value={tanggalJatuhTempo}
            onChange={(e) => setTanggalJatuhTempo(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Button Catat */}
      {customer && (
        <Button
          onClick={handleCatatMeteran}
          disabled={loadingCatat || !meteranBaru}
          className="bg-gradient-gold text-black font-semibold hover:opacity-90"
        >
          {loadingCatat && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Gauge className="h-4 w-4 mr-2" />
          Catat Meteran
        </Button>
      )}

      {/* Result Card */}
      {result && (
        <Card className="border border-green-700 bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-400">Hasil Pencatatan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Bill ID</span>
              <p className="font-semibold text-foreground">#{result.bill_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Pemakaian</span>
              <p className="font-semibold text-foreground">{result.pemakaian} m³</p>
            </div>
            <div>
              <span className="text-muted-foreground">Jumlah Tagihan</span>
              <p className="font-semibold text-foreground">{formatRupiah(result.jumlah_tagihan)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ─── Tab 2: Bulk ──────────────────────────────────────────────────────────────

const BulkTab: React.FC = () => {
  const { toast } = useToast();

  const [periodeBulk, setPeriodeBulk] = useState<string>(currentPeriode());
  const [jatuhTempoBulk, setJatuhTempoBulk] = useState<string>('');
  const [template, setTemplate] = useState<TemplateRow[] | null>(null);
  const [editedReadings, setEditedReadings] = useState<Record<number, string>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  const handleLoadTemplate = async () => {
    if (!periodeBulk) {
      toast({ title: 'Peringatan', description: 'Periode harus diisi.', variant: 'destructive' });
      return;
    }
    setLoadingTemplate(true);
    setTemplate(null);
    setEditedReadings({});
    setBulkResult(null);
    try {
      const res = await api.get<{ periode: string; template: TemplateRow[] }>(
        `/operator/meter-template/${periodeBulk}`
      );
      setTemplate(res.data.template);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Gagal memuat template.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleInputChange = (idKlien: number, value: string) => {
    setEditedReadings((prev) => ({ ...prev, [idKlien]: value }));
  };

  const handleSubmitBulk = async () => {
    if (!template) return;

    const readings = template
      .filter(
        (row) =>
          !row.sudah_dicatat &&
          editedReadings[row.id_klien] !== undefined &&
          editedReadings[row.id_klien] !== ''
      )
      .map((row) => ({
        id_klien: row.id_klien,
        meteran_baru: Number(editedReadings[row.id_klien]),
      }));

    if (readings.length === 0) {
      toast({
        title: 'Peringatan',
        description: 'Tidak ada data meteran baru yang diisi.',
        variant: 'destructive',
      });
      return;
    }

    setLoadingSubmit(true);
    setBulkResult(null);
    try {
      const payload: Record<string, unknown> = {
        periode: periodeBulk,
        readings,
      };
      if (jatuhTempoBulk) payload.tanggal_jatuh_tempo = jatuhTempoBulk;

      const res = await api.post<BulkResult>('/operator/catat-meteran/bulk', payload);
      setBulkResult(res.data);
      toast({
        title: 'Selesai',
        description: `${res.data.berhasil} berhasil dicatat.`,
      });
      // Reload template to reflect updated status
      await handleLoadTemplate();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Gagal submit bulk.';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Row 1 — Periode + Load */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="periode-bulk">Periode (YYYY-MM)</Label>
          <Input
            id="periode-bulk"
            type="month"
            value={periodeBulk}
            onChange={(e) => setPeriodeBulk(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleLoadTemplate}
          disabled={loadingTemplate}
        >
          {loadingTemplate ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Load Template
        </Button>
      </div>

      {/* Tabel Template */}
      {template && (
        <div className="rounded-lg border border-brown-medium overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="text-gold">ID Klien</TableHead>
                <TableHead className="text-gold">Nama</TableHead>
                <TableHead className="text-gold">Meteran Terakhir</TableHead>
                <TableHead className="text-gold">Meteran Baru</TableHead>
                <TableHead className="text-gold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {template.map((row) => (
                <TableRow key={row.id_klien} className="hover:bg-white/5">
                  <TableCell className="text-foreground">{row.id_klien}</TableCell>
                  <TableCell className="text-foreground">{row.nama}</TableCell>
                  <TableCell className="text-foreground">{row.meteran_terakhir} m³</TableCell>
                  <TableCell>
                    {row.sudah_dicatat ? (
                      <span className="text-muted-foreground text-sm">
                        {row.meteran_baru !== null ? `${row.meteran_baru} m³` : '—'}
                      </span>
                    ) : (
                      <Input
                        type="number"
                        placeholder={`Min: ${row.meteran_terakhir}`}
                        min={row.meteran_terakhir}
                        value={editedReadings[row.id_klien] ?? ''}
                        onChange={(e) => handleInputChange(row.id_klien, e.target.value)}
                        className="w-36 h-8 text-sm"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.sudah_dicatat ? (
                      <Badge className="bg-green-700 text-white text-xs">Sudah Dicatat</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs border-brown-medium">
                        Belum
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Row — Jatuh Tempo + Submit */}
      {template && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="jatuh-tempo-bulk">Jatuh Tempo</Label>
            <Input
              id="jatuh-tempo-bulk"
              type="date"
              value={jatuhTempoBulk}
              onChange={(e) => setJatuhTempoBulk(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            onClick={handleSubmitBulk}
            disabled={loadingSubmit}
            className="bg-gradient-gold text-black font-semibold hover:opacity-90"
          >
            {loadingSubmit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit Semua
          </Button>
        </div>
      )}

      {/* Bulk Result */}
      {bulkResult && (
        <Alert
          className={
            bulkResult.gagal > 0
              ? 'border-yellow-600 bg-yellow-950/30'
              : 'border-green-700 bg-green-950/30'
          }
        >
          <Gauge className="h-4 w-4" />
          <AlertTitle className={bulkResult.gagal > 0 ? 'text-yellow-400' : 'text-green-400'}>
            Hasil Bulk Pencatatan
          </AlertTitle>
          <AlertDescription className="mt-1 space-y-2">
            <p className="text-foreground">
              <span className="font-semibold text-green-400">{bulkResult.berhasil} berhasil</span>
              {bulkResult.gagal > 0 && (
                <>
                  {' '}·{' '}
                  <span className="font-semibold text-red-400">{bulkResult.gagal} gagal</span>
                </>
              )}
            </p>
            {bulkResult.errors && bulkResult.errors.length > 0 && (
              <ul className="list-disc list-inside text-sm text-red-400 space-y-1">
                {bulkResult.errors.map((e, i) => (
                  <li key={i}>
                    ID {e.id_klien}{e.nama ? ` (${e.nama})` : ''}: {e.pesan}
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const MeterReadingPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-gold rounded-lg">
          <Gauge className="h-5 w-5 text-black" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catat Meteran</h1>
          <p className="text-sm text-muted-foreground">
            Input pembacaan meteran air per pelanggan atau secara massal
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Card className="border border-brown-medium bg-card">
        <CardContent className="pt-6">
          <Tabs defaultValue="single">
            <TabsList className="mb-6">
              <TabsTrigger value="single">Input Single</TabsTrigger>
              <TabsTrigger value="bulk">Input Bulk</TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <SingleTab />
            </TabsContent>

            <TabsContent value="bulk">
              <BulkTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
