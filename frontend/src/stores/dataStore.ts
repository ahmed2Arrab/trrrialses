import { create } from "zustand";
import { api } from "../utils/api";
import { normalizeClient } from "../utils/clientModel";
import type { DataState, Client } from "../types";

export const useDataStore = create<DataState>((set, get) => ({
  clients: [],
  trash: [],
  isLoading: false,
  error: null,

  loadData: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/api/data");
      if (response.data) {
        const rawClients = response.data.clientsDB || [];
        set({
          clients: rawClients.map((c: unknown) =>
            normalizeClient(c as Partial<Client>),
          ),
          trash: (response.data.trashDB || []).map((c: unknown) =>
            normalizeClient(c as Partial<Client>),
          ),
          isLoading: false,
        });
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      const errorMessage = ax.response?.data?.error || "Failed to load data";
      set({ error: errorMessage, isLoading: false });
    }
  },

  saveData: async () => {
    const { clients, trash } = get();
    try {
      await api.post("/api/data", {
        clientsDB: clients,
        trashDB: trash,
      });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      const errorMessage = ax.response?.data?.error || "Failed to save data";
      set({ error: errorMessage });
    }
  },

  addClient: async (clientData) => {
    const newClient: Client = normalizeClient({
      id: Date.now().toString(),
      ...clientData,
    });

    set((state) => ({
      clients: [...state.clients, newClient],
    }));

    await get().saveData();
  },

  updateClient: async (id: string, updates: Partial<Client>) => {
    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? normalizeClient({ ...c, ...updates }) : c,
      ),
    }));

    await get().saveData();
  },

  deleteClient: async (id: string) => {
    set((state) => {
      const clientToMove = state.clients.find((c) => c.id === id);
      return {
        clients: state.clients.filter((c) => c.id !== id),
        trash: clientToMove ? [...state.trash, clientToMove] : state.trash,
      };
    });

    await get().saveData();
  },

  restoreClient: async (id: string) => {
    set((state) => {
      const clientToRestore = state.trash.find((c) => c.id === id);
      return {
        trash: state.trash.filter((c) => c.id !== id),
        clients: clientToRestore
          ? [...state.clients, clientToRestore]
          : state.clients,
      };
    });

    await get().saveData();
  },

  permanentDeleteClient: async (id: string) => {
    set((state) => ({
      trash: state.trash.filter((c) => c.id !== id),
    }));

    try {
      await api.post("/api/permanent-delete-client", {
        clientId: id,
      });
      await get().saveData();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      const errorMessage = ax.response?.data?.error || "Failed to delete";
      set({ error: errorMessage });
    }
  },

  uploadClientFile: async (clientId, file, fileType) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("clientId", clientId);
    formData.append("fileType", fileType);

    const { data } = await api.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (data.success && data.file) {
      const key = fileType === "receipts" ? "receipts" : "pdfs";
      set((state) => ({
        clients: state.clients.map((c) => {
          if (c.id !== clientId) return c;
          const list = [...(c[key] || []), data.file];
          return { ...c, [key]: list };
        }),
      }));
    }
  },

  deleteClientFile: async (clientId, filename, fileType) => {
    await api.post("/api/delete-pdf", {
      clientId,
      filename,
      type: fileType,
    });

    const key = fileType === "receipts" ? "receipts" : "pdfs";
    set((state) => ({
      clients: state.clients.map((c) => {
        if (c.id !== clientId) return c;
        return {
          ...c,
          [key]: (c[key] || []).filter((f) => f.filename !== filename),
        };
      }),
    }));
  },
}));
