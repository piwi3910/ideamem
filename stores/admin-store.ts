import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppConfig {
  qdrantUrl: string;
  ollamaUrl: string;
  docReindexEnabled: boolean;
  docReindexInterval: number;
}

interface Status {
  status: 'ok' | 'error' | 'unknown' | 'not_found' | 'pulling_started';
  message: string;
}

interface AdminState {
  // Configuration state
  config: AppConfig;
  saveMessage: string;
  
  // Service status state
  qdrantStatus: Status;
  ollamaStatus: Status;
  embeddingStatus: Status;
  isTesting: boolean;
  
  // Actions
  setConfig: (config: AppConfig) => void;
  setSaveMessage: (message: string) => void;
  setQdrantStatus: (status: Status) => void;
  setOllamaStatus: (status: Status) => void;
  setEmbeddingStatus: (status: Status) => void;
  setIsTesting: (testing: boolean) => void;
  reset: () => void;
}

const initialState = {
  config: {
    qdrantUrl: '',
    ollamaUrl: '',
    docReindexEnabled: true,
    docReindexInterval: 14,
  },
  saveMessage: '',
  qdrantStatus: { status: 'unknown' as const, message: '' },
  ollamaStatus: { status: 'unknown' as const, message: '' },
  embeddingStatus: { status: 'unknown' as const, message: '' },
  isTesting: false,
};

export const useAdminStore = create<AdminState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        
        setConfig: (config) =>
          set((state) => ({ config }), false, 'admin/setConfig'),
          
        setSaveMessage: (saveMessage) =>
          set({ saveMessage }, false, 'admin/setSaveMessage'),
          
        setQdrantStatus: (qdrantStatus) =>
          set({ qdrantStatus }, false, 'admin/setQdrantStatus'),
          
        setOllamaStatus: (ollamaStatus) =>
          set({ ollamaStatus }, false, 'admin/setOllamaStatus'),
          
        setEmbeddingStatus: (embeddingStatus) =>
          set({ embeddingStatus }, false, 'admin/setEmbeddingStatus'),
          
        setIsTesting: (isTesting) =>
          set({ isTesting }, false, 'admin/setIsTesting'),
          
        reset: () =>
          set(initialState, false, 'admin/reset'),
      }),
      {
        name: 'admin-store',
        // Only persist config and status, not temporary states like saveMessage
        partialize: (state) => ({
          config: state.config,
          qdrantStatus: state.qdrantStatus,
          ollamaStatus: state.ollamaStatus,
          embeddingStatus: state.embeddingStatus,
        }),
      }
    ),
    {
      name: 'admin-store',
    }
  )
);