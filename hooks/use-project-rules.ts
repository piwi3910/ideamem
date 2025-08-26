import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface Rule {
  id: string;
  score?: number;
  payload: {
    content: string;
    source: string;
    type: 'rule';
    language: 'markdown';
    scope: 'project';
    project_id: string;
  };
}

export interface CreateRuleData {
  source: string;
  content: string;
}

export interface UpdateRuleData {
  source: string;
  content: string;
}

// Query keys
export const projectRuleKeys = {
  all: ['project-rules'] as const,
  byProject: (projectId: string) => [...projectRuleKeys.all, projectId] as const,
};

// API functions
async function fetchProjectRules(projectId: string): Promise<Rule[]> {
  const response = await fetch(`/api/projects/${projectId}/rules`);
  if (!response.ok) {
    throw new Error(`Failed to fetch rules: ${response.statusText}`);
  }
  const data = await response.json();
  return data.rules || [];
}

async function createProjectRule(projectId: string, ruleData: CreateRuleData): Promise<Rule> {
  const response = await fetch(`/api/projects/${projectId}/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ruleData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create rule');
  }
  
  const data = await response.json();
  return data.rule;
}

async function updateProjectRule(projectId: string, ruleData: UpdateRuleData): Promise<Rule> {
  const response = await fetch(`/api/projects/${projectId}/rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ruleData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update rule');
  }
  
  const data = await response.json();
  return data.rule;
}

async function deleteProjectRule(projectId: string, source: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/rules?source=${encodeURIComponent(source)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete rule');
  }
}

// Hooks
export function useProjectRules(projectId: string) {
  return useQuery({
    queryKey: projectRuleKeys.byProject(projectId),
    queryFn: () => fetchProjectRules(projectId),
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateProjectRule(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ruleData: CreateRuleData) => createProjectRule(projectId, ruleData),
    onSuccess: () => {
      // Invalidate and refetch rules list
      queryClient.invalidateQueries({ queryKey: projectRuleKeys.byProject(projectId) });
    },
  });
}

export function useUpdateProjectRule(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ruleData: UpdateRuleData) => updateProjectRule(projectId, ruleData),
    onSuccess: () => {
      // Invalidate and refetch rules list
      queryClient.invalidateQueries({ queryKey: projectRuleKeys.byProject(projectId) });
    },
  });
}

export function useDeleteProjectRule(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (source: string) => deleteProjectRule(projectId, source),
    onSuccess: () => {
      // Invalidate and refetch rules list
      queryClient.invalidateQueries({ queryKey: projectRuleKeys.byProject(projectId) });
    },
  });
}