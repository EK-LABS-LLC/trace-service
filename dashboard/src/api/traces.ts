import { useQuery } from "@tanstack/react-query";
import {
  getOTelTrace,
  getOTelTraceSpans,
  getTrace,
  getTraces,
  type GetTracesParams,
} from "../lib/apiClient";

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
  enabled = true,
) {
  return useQuery({
    queryKey: ["trace", projectId, traceId],
    enabled: enabled && !!projectId && !!traceId,
    queryFn: () => getTrace(traceId as string),
  });
}

export function useOTelTraceQuery(
  projectId: string | undefined,
  traceId: string | undefined,
) {
  return useQuery({
    queryKey: ["otel-trace", projectId, traceId],
    enabled: !!projectId && !!traceId,
    queryFn: () => getOTelTrace(traceId as string),
    retry: false,
  });
}

export function useOTelTraceSpansQuery(
  projectId: string | undefined,
  traceId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["otel-trace-spans", projectId, traceId],
    enabled: enabled && !!projectId && !!traceId,
    queryFn: () => getOTelTraceSpans(traceId as string),
    retry: false,
  });
}
