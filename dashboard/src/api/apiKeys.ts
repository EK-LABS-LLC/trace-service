import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProjectUser,
  deleteApiKey,
  getApiKeys,
  getProjectUsers,
  updateApiKeyName,
  type CreateProjectUserInput,
} from "../lib/apiClient";

export function useApiKeysQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: ["api-keys", projectId],
    enabled: !!projectId,
    queryFn: getApiKeys,
  });
}

export function useProjectUsersQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-users", projectId],
    enabled: !!projectId,
    queryFn: getProjectUsers,
  });
}

export function useDeleteApiKeyMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
    },
  });
}

export function useUpdateApiKeyNameMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId, name }: { keyId: string; name: string }) =>
      updateApiKeyName(keyId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
    },
  });
}

export function useCreateProjectUserMutation(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectUserInput) => createProjectUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-users", projectId] });
    },
  });
}
