export type UserRole = "admin" | "accountant" | "admin_readonly" | "staff";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
  plot: string;
  totalContract: number;
  paid: number;
  phone: string;
  expenses: Expense[];
  tips: Tip[];
  payments: Payment[];
  docs: Document[];
  pdfs: FileRecord[];
  receipts: FileRecord[];
}

export interface Expense {
  reason: string;
  amount: number;
  date: string;
}

export interface Tip {
  reason: string;
  payer: string;
  amount: number;
  date: string;
}

export interface Payment {
  id: string;
  receiver: string;
  amount: number;
  date: string;
}

export interface Document {
  person: string;
  name: string;
  purpose: string;
  place: string;
  date: string;
}

export interface FileRecord {
  filename: string;
  originalName: string;
  date: string;
  path: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export interface DataState {
  clients: Client[];
  trash: Client[];
  isLoading: boolean;
  error: string | null;
  loadData: () => Promise<void>;
  saveData: () => Promise<void>;
  addClient: (client: Omit<Client, "id">) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  restoreClient: (id: string) => Promise<void>;
  permanentDeleteClient: (id: string) => Promise<void>;
  uploadClientFile: (
    clientId: string,
    file: File,
    fileType: "receipts" | "pdfs",
  ) => Promise<void>;
  deleteClientFile: (
    clientId: string,
    filename: string,
    fileType: "receipts" | "pdfs",
  ) => Promise<void>;
}
