import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Constraint {
  id: string;
  score?: number;
  payload: {
    content: string;
    source: string;
    category: 'rule' | 'tooling' | 'workflow' | 'formatting';
    type: 'user_preference';
    language: 'markdown';
    scope: 'global' | 'project';
    project_id: string;
  };
}

export interface CreateConstraintData {
  source: string;
  content: string;
  category: 'rule' | 'tooling' | 'workflow' | 'formatting';
}

export interface UpdateConstraintData {
  id: string;
  source?: string;
  content?: string;
  category?: 'rule' | 'tooling' | 'workflow' | 'formatting';
}

// Query keys
export const constraintKeys = {
  all: ['constraints'] as const,
  global: () => [...constraintKeys.all, 'global'] as const,
  project: (projectId: string) => [...constraintKeys.all, 'project', projectId] as const,
  filtered: (scope: 'global' | 'project', projectId: string | undefined, filters: Record<string, any>) => {
    const baseKey = scope === 'global' ? constraintKeys.global() : constraintKeys.project(projectId!);
    return [...baseKey, { filters }] as const;
  },
};

// API functions
async function fetchGlobalConstraints(): Promise<{
  constraints: Constraint[];
  category_counts: Record<string, number>;
  total: number;
}> {
  const response = await fetch('/api/global/constraints');
  if (!response.ok) {
    throw new Error(`Failed to fetch global constraints: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data;
}

async function fetchProjectConstraints(projectId: string): Promise<{
  constraints: Constraint[];
  category_counts: Record<string, number>;
  total: number;
}> {
  const response = await fetch(`/api/projects/${projectId}/constraints`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project constraints: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data;
}

async function createGlobalConstraint(constraintData: CreateConstraintData): Promise<Constraint> {
  const response = await fetch('/api/global/constraints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...constraintData,
      language: 'markdown',
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create constraint');
  }
  
  const data = await response.json();
  return data.data.constraint;
}

async function createProjectConstraint(
  projectId: string,
  constraintData: CreateConstraintData
): Promise<Constraint> {
  const response = await fetch(`/api/projects/${projectId}/constraints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...constraintData,
      language: 'markdown',
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create constraint');
  }
  
  const data = await response.json();
  return data.data.constraint;
}

async function updateGlobalConstraint(updateData: UpdateConstraintData): Promise<Constraint> {
  const { id, ...data } = updateData;
  const response = await fetch('/api/global/constraints', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update constraint');
  }
  
  const responseData = await response.json();
  return responseData.data.constraint;
}

async function updateProjectConstraint(
  projectId: string,
  updateData: UpdateConstraintData
): Promise<Constraint> {
  const { id, ...data } = updateData;
  const response = await fetch(`/api/projects/${projectId}/constraints`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update constraint');
  }
  
  const responseData = await response.json();
  return responseData.data.constraint;
}

async function deleteGlobalConstraint(source: string): Promise<void> {
  const response = await fetch('/api/global/constraints', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete constraint');
  }
}

async function deleteProjectConstraint(projectId: string, source: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/constraints`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete constraint');
  }
}

// Global Constraints Hooks
export function useGlobalConstraints() {
  return useQuery({
    queryKey: constraintKeys.global(),
    queryFn: fetchGlobalConstraints,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateGlobalConstraint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createGlobalConstraint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: constraintKeys.global() });
    },
  });
}

export function useUpdateGlobalConstraint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateGlobalConstraint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: constraintKeys.global() });
    },
  });
}

export function useDeleteGlobalConstraint() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteGlobalConstraint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: constraintKeys.global() });
    },
  });
}

// Project Constraints Hooks
export function useProjectConstraints(projectId: string) {
  return useQuery({
    queryKey: constraintKeys.project(projectId),
    queryFn: () => fetchProjectConstraints(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateProjectConstraint(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (constraintData: CreateConstraintData) =>
      createProjectConstraint(projectId, constraintData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: constraintKeys.project(projectId) });
    },
  });
}

export function useUpdateProjectConstraint(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updateData: UpdateConstraintData) =>
      updateProjectConstraint(projectId, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: constraintKeys.project(projectId) });
    },
  });
}

export function useDeleteProjectConstraint(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (source: string) => deleteProjectConstraint(projectId, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: constraintKeys.project(projectId) });
    },
  });
}