import { useQuery } from "@tanstack/react-query";
import {
  getAgentSessions,
  getSpansAnalytics,
  getSpans,
  type GetAgentSessionsParams,
  type GetSpansAnalyticsParams,
  type GetSpansParams,
} from "../lib/apiClient";

export function useSpansAnalyticsQuery(
  scope: string,
  projectId: string | undefined,
  params: GetSpansAnalyticsParams,
) {
  return useQuery({
    queryKey: [
      scope,
      projectId,
      params.date_from,
      params.date_to,
      params.group_by,
    ],
    enabled: !!projectId,
    queryFn: () => getSpansAnalytics(params),
  });
}

export function useSpansQuery(
  scope: string,
  projectId: string | undefined,
  params: GetSpansParams = {},
) {
  return useQuery({
    queryKey: [scope, projectId, params],
    enabled: !!projectId,
    queryFn: () => getSpans(params),
  });
}

export function useAgentSessionsQuery(
  scope: string,
  projectId: string | undefined,
  params: GetAgentSessionsParams = {},
) {
  return useQuery({
    queryKey: [scope, projectId, params],
    enabled: !!projectId,
    queryFn: () => getAgentSessions(params),
  });
}
