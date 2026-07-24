import { useQuery } from "@tanstack/react-query";
import { getSessionTraceSummaries } from "../lib/apiClient";

export function useSessionTraceSummariesQuery(
  projectId: string | undefined,
  sessionId: string | undefined,
) {
  return useQuery({
    queryKey: ["session", projectId, sessionId],
    enabled: !!projectId && !!sessionId,
    queryFn: () => getSessionTraceSummaries(sessionId as string),
  });
}
