import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  
  // Modal states
  createProjectModalOpen: boolean;
  deleteProjectModalOpen: boolean;
  selectedProjectId: string | null;
  
  // Search UI state
  searchPanelOpen: boolean;
  searchHistory: Array<{
    query: string;
    timestamp: Date;
    resultsCount: number;
  }>;
  savedSearches: string[];
  
  // Actions
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  openCreateProjectModal: () => void;
  closeCreateProjectModal: () => void;
  openDeleteProjectModal: (projectId: string) => void;
  closeDeleteProjectModal: () => void;
  toggleSearchPanel: () => void;
  addToSearchHistory: (query: string, resultsCount: number) => void;
  saveSearch: (query: string) => void;
  removeSavedSearch: (query: string) => void;
  clearSearchHistory: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      createProjectModalOpen: false,
      deleteProjectModalOpen: false,
      selectedProjectId: null,
      searchPanelOpen: false,
      searchHistory: [],
      savedSearches: [],

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }), false, 'ui/toggleSidebar'),

      toggleMobileMenu: () =>
        set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen }), false, 'ui/toggleMobileMenu'),

      openCreateProjectModal: () =>
        set({ createProjectModalOpen: true }, false, 'ui/openCreateProjectModal'),

      closeCreateProjectModal: () =>
        set({ createProjectModalOpen: false }, false, 'ui/closeCreateProjectModal'),

      openDeleteProjectModal: (projectId: string) =>
        set({ deleteProjectModalOpen: true, selectedProjectId: projectId }, false, 'ui/openDeleteProjectModal'),

      closeDeleteProjectModal: () =>
        set({ deleteProjectModalOpen: false, selectedProjectId: null }, false, 'ui/closeDeleteProjectModal'),

      toggleSearchPanel: () =>
        set((state) => ({ searchPanelOpen: !state.searchPanelOpen }), false, 'ui/toggleSearchPanel'),

      addToSearchHistory: (query: string, resultsCount: number) =>
        set((state) => ({
          searchHistory: [
            { query, timestamp: new Date(), resultsCount },
            ...state.searchHistory.slice(0, 49) // Keep last 50 searches
          ]
        }), false, 'ui/addToSearchHistory'),

      saveSearch: (query: string) =>
        set((state) => ({
          savedSearches: state.savedSearches.includes(query) 
            ? state.savedSearches 
            : [...state.savedSearches, query]
        }), false, 'ui/saveSearch'),

      removeSavedSearch: (query: string) =>
        set((state) => ({
          savedSearches: state.savedSearches.filter(s => s !== query)
        }), false, 'ui/removeSavedSearch'),

      clearSearchHistory: () =>
        set({ searchHistory: [] }, false, 'ui/clearSearchHistory'),
    }),
    {
      name: 'ui-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);