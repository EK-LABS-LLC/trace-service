import { useQuery } from "@tanstack/react-query";
import { getTrace, getTraces, type GetTracesParams } from "../lib/apiClient";

export function useTracesQuery(
  scope: string,
  projectId: string | undefined,
  params: GetTracesParams,
) {
  return useQuery({
    queryKey: [scope, projectId, params],
    enabled: !!projectId,
    queryFn: () => getTraces(params),
  });
}

export function useTraceDetailQuery(
  projectId: string | undefined,
  traceId: string | undefined,
) {
  return useQuery({
    queryKey: ["trace", projectId, traceId],
    enabled: !!projectId && !!traceId,
    queryFn: () => getTrace(traceId as string),
  });
}
