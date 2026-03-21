import { create } from 'zustand';

interface User {
  id: string;
  email?: string;
}

interface AuthState {
  user: User | null;
  businessId: string | null;
  setUser: (user: User | null) => void;
  setBusinessId: (id: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  businessId: null,
  setUser: (user) => set({ user }),
  setBusinessId: (businessId) => set({ businessId }),
  logout: () => set({ user: null, businessId: null }),
}));
