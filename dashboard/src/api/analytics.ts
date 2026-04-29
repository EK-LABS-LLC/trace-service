import { useQuery } from "@tanstack/react-query";
import { getAnalytics, type GetAnalyticsParams } from "../lib/apiClient";

export function useAnalyticsQuery(
  scope: string,
  projectId: string | undefined,
  params: GetAnalyticsParams,
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
    queryFn: () => getAnalytics(params),
  });
}
