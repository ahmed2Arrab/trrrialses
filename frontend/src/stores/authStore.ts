import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../utils/api";
import type { AuthState, User } from "../types";

export {
  canViewFinancials,
  canEditRecords as canEdit,
  canDeleteClients as canDelete,
  canAccessBackup,
  canViewTrash,
  canPermanentDeleteFromTrash,
  isStaff,
} from "../utils/permissions";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/api/login", {
            username,
            password,
          });

          if (response.data.success) {
            const userData: User = response.data.user;
            set({ user: userData, isLoading: false });
          } else {
            set({
              error: response.data.error || "Login failed",
              isLoading: false,
            });
          }
        } catch (err: unknown) {
          const ax = err as { response?: { data?: { error?: string } } };
          const errorMessage =
            ax.response?.data?.error || "Failed to login";
          set({ error: errorMessage, isLoading: false });
        }
      },

      logout: () => {
        set({ user: null, error: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
