import { useQuery } from "@tanstack/react-query";
import {
  getSpansAnalytics,
  getSessionSpans,
  getSpans,
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

export function useSessionSpansQuery(
  scope: string,
  projectId: string | undefined,
  sessionId: string | undefined,
) {
  return useQuery({
    queryKey: [scope, projectId, sessionId],
    enabled: !!projectId && !!sessionId,
    queryFn: () => getSessionSpans(sessionId!),
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
