import { useQuery } from "@tanstack/react-query";
import { getSession } from "../lib/apiClient";

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
