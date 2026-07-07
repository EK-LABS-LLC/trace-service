import { useQuery } from "@tanstack/react-query";
import {
  getOTelSessionTraces,
  getOTelSessions,
  getSession,
  type GetOTelSessionsParams,
  type GetOTelTracesParams,
} from "../lib/apiClient";

export function useSessionDetailQuery(
  projectId: string | undefined,
  sessionId: string | undefined,
) {
  return useQuery({
    queryKey: ["session", projectId, sessionId],
    enabled: !!projectId && !!sessionId,
    queryFn: () => getSession(sessionId as string),
  });
}

export function useOTelSessionsQuery(
  scope: string,
  projectId: string | undefined,
  params: GetOTelSessionsParams = {},
) {
  return useQuery({
    queryKey: [scope, projectId, params],
    enabled: !!projectId,
    queryFn: () => getOTelSessions(params),
  });
}

export function useOTelSessionTracesQuery(
  scope: string,
  projectId: string | undefined,
  sessionId: string | undefined,
  params: GetOTelTracesParams = {},
) {
  return useQuery({
    queryKey: [scope, projectId, sessionId, params],
    enabled: !!projectId && !!sessionId,
    queryFn: () => getOTelSessionTraces(sessionId as string, params),
  });
}
