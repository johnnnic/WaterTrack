import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';

interface AuditLog {
  id: number;
  action: string;
  subject_type: string | null;
  subject_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user: { id: number; name: string; role: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  login:  'bg-yellow-500',
  logout: 'bg-gray-500',
};

export const AuditLogPage = () => {
  const [logs, setLogs]     = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const { data } = await api.get('/admin/audit-logs', { params });
      setLogs(data.data ?? data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-4">Audit Log</h1>

      <div className="flex gap-3 mb-6 items-end">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Dari tanggal</p>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Sampai tanggal</p>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button onClick={fetchLogs} variant="outline">Filter</Button>
        <Button onClick={() => { setDateFrom(''); setDateTo(''); }} variant="ghost">Reset</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground">Tidak ada log yang ditemukan.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Subjek</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('id-ID')}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{log.user?.name ?? 'System'}</span>
                  {log.user && (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({log.user.role})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={ACTION_COLORS[log.action] ?? 'bg-gray-500'}>
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  {log.subject_type
                    ? `${log.subject_type} #${log.subject_id}`
                    : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.ip_address ?? '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
