export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'kasir' | 'klien';
  customer_id: number | null;
  password_changed_at: string | null;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  mustChangePassword: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}
