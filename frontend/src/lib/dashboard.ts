export const formatRupiah = (angka: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalBills: number;
  monthlyBills: number;
  totalPayments: number;
  unpaidBills: number;
  todayPayments: number;
  todayPaymentsAmount: number;
  monthlyPaymentsAmount: number;
}

export interface RecentActivity {
  id: number;
  type: 'payment' | 'customer' | 'bill' | 'meter';
  action: string;
  customer: string;
  amount: string;
  time: string;
}
