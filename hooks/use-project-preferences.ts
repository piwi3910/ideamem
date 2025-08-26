import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Preference {
  id: string;
  score?: number;
  payload: {
    content: string;
    source: string;
    type: 'user_preference';
    language: 'markdown';
    scope: 'project';
    project_id: string;
  };
}

export interface CreatePreferenceData {
  source: string;
  content: string;
}

export interface UpdatePreferenceData {
  source: string;
  content: string;
}

// Query keys
export const projectPreferenceKeys = {
  all: ['project-preferences'] as const,
  byProject: (projectId: string) => [...projectPreferenceKeys.all, projectId] as const,
};

// API functions
async function fetchProjectPreferences(projectId: string): Promise<Preference[]> {
  const response = await fetch(`/api/projects/${projectId}/preferences`);
  if (!response.ok) {
    throw new Error(`Failed to fetch preferences: ${response.statusText}`);
  }
  const data = await response.json();
  return data.preferences || [];
}

async function createProjectPreference(projectId: string, preferenceData: CreatePreferenceData): Promise<Preference> {
  const response = await fetch(`/api/projects/${projectId}/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferenceData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create preference');
  }
  
  const data = await response.json();
  return data.preference;
}

async function updateProjectPreference(projectId: string, preferenceData: UpdatePreferenceData): Promise<Preference> {
  const response = await fetch(`/api/projects/${projectId}/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferenceData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update preference');
  }
  
  const data = await response.json();
  return data.preference;
}

async function deleteProjectPreference(projectId: string, source: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/preferences?source=${encodeURIComponent(source)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete preference');
  }
}

// Hooks
export function useProjectPreferences(projectId: string) {
  return useQuery({
    queryKey: projectPreferenceKeys.byProject(projectId),
    queryFn: () => fetchProjectPreferences(projectId),
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateProjectPreference(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preferenceData: CreatePreferenceData) => createProjectPreference(projectId, preferenceData),
    onSuccess: () => {
      // Invalidate and refetch preferences list
      queryClient.invalidateQueries({ queryKey: projectPreferenceKeys.byProject(projectId) });
    },
  });
}

export function useUpdateProjectPreference(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preferenceData: UpdatePreferenceData) => updateProjectPreference(projectId, preferenceData),
    onSuccess: () => {
      // Invalidate and refetch preferences list
      queryClient.invalidateQueries({ queryKey: projectPreferenceKeys.byProject(projectId) });
    },
  });
}

export function useDeleteProjectPreference(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (source: string) => deleteProjectPreference(projectId, source),
    onSuccess: () => {
      // Invalidate and refetch preferences list
      queryClient.invalidateQueries({ queryKey: projectPreferenceKeys.byProject(projectId) });
    },
  });
}