import { getApiBaseUrl } from "./runtime-config";

const SELECTED_PROJECT_KEY = "pulse_selected_project";

const getBaseUrl = (): string => {
  return getApiBaseUrl();
};

const getProjectHeaders = (): HeadersInit => {
  const projectId = localStorage.getItem(SELECTED_PROJECT_KEY);
  return projectId ? { "X-Project-Id": projectId } : {};
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    let message = `Request failed with status ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      message = errorJson.error || errorJson.message || message;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }
  return response.json();
};

export interface GetTracesParams {
  session_id?: string;
  provider?: string;
  model?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface Trace {
  traceId: string;
  timestamp: string;
  provider: string;
  modelRequested: string;
  modelUsed: string;
  latencyMs: number;
  status: "success" | "error";
  costCents: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  outputText?: string;
  finishReason?: string;
}

export interface TracesResponse {
  traces: Trace[];
  total: number;
}

export interface Session {
  sessionId: string;
  traces: Trace[];
  spans?: Span[];
}

export type SpanSource = "claude_code" | "opencode" | "openclaw";

export type SpanKind =
  | "tool_use"
  | "agent_run"
  | "session"
  | "user_prompt"
  | "notification";

export interface Span {
  spanId: string;
  sessionId: string;
  parentSpanId?: string;
  timestamp: string;
  durationMs?: number;
  source: SpanSource;
  kind: SpanKind;
  eventType: string;
  status: "success" | "error";
  toolUseId?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResponse?: unknown;
  error?: unknown;
  isInterrupt?: boolean;
  cwd?: string;
  model?: string;
  agentName?: string;
  metadata?: Record<string, unknown>;
}

export interface SpansResponse {
  spans: Span[];
  total: number;
}

export interface GetSpansParams {
  session_id?: string;
  source?: SpanSource;
  kind?: SpanKind;
  tool_name?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface GetAnalyticsParams {
  date_from?: string;
  date_to?: string;
  group_by?: "day" | "hour" | "model" | "provider";
}

export interface CostOverTimeByProvider {
  period: string;
  provider: string;
  costCents: number;
}

export interface CostByProvider {
  provider: string;
  costCents: number;
  requests: number;
}

export interface StatsByModel {
  provider: string;
  model: string;
  requests: number;
  costCents: number;
  avgLatency: number;
  totalTokens: number;
  errorRate: number;
}

export interface LatencyBucket {
  bucket: string;
  count: number;
}

export interface TotalTokens {
  input: number;
  output: number;
  total: number;
}

export interface ComputedMetrics {
  costPerRequest: number;
  tokensPerRequest: number;
  costPer1kTokens: number;
  tracesPerSession: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

// Spans Analytics Response
export interface SpansAnalyticsResponse {
  agentRuns: number;
  toolCalls: number;
  avgSessionDurationMs: number;
  successRate: number;
  topTools: Array<{ name: string; count: number }>;
  // Extra fields
  totalSpans: number;
  errorRate: number;
  avgDurationMs: number;
  spansByKind: Array<{ kind: string; count: number }>;
  spansBySource: Array<{ source: string; count: number }>;
  spansOverTime: Array<{ period: string; count: number }>;
}

// Session Spans Response
export interface SessionSpansResponse {
  sessionId: string;
  spans: Span[];
}

export interface GetSpansAnalyticsParams {
  date_from: string;
  date_to: string;
  group_by?: "day" | "hour";
}

export interface AnalyticsResponse {
  totalCost: number;
  totalRequests: number;
  totalSessions: number;
  totalTokens: TotalTokens;
  avgLatency: number;
  errorRate: number;
  costOverTime: CostOverTimeByProvider[];
  costByProvider: CostByProvider[];
  topModels: StatsByModel[];
  computed: ComputedMetrics;
}

export interface ProjectInfo {
  id: string;
  name: string;
  createdAt: string;
  role: string;
}

export interface CreateProjectResult {
  projectId: string;
  apiKey: string;
  name: string;
}

export interface ApiKeyInfo {
  id: string;
  projectId: string;
  projectName: string;
  key: string;
  name: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ApiKeysResponse {
  keys: ApiKeyInfo[];
}

export interface ProjectUserInfo {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

export interface ProjectUsersResponse {
  users: ProjectUserInfo[];
}

export interface CreateProjectUserInput {
  name?: string;
  email: string;
  password?: string;
  role?: "admin" | "user";
}

export const getTraces = async (
  params: GetTracesParams = {},
): Promise<TracesResponse> => {
  const url = new URL(`${getBaseUrl()}/dashboard/api/traces`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<TracesResponse>(response);
};

export const getTrace = async (id: string): Promise<Trace> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/traces/${id}`, {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<Trace>(response);
};

export const getSession = async (id: string): Promise<Session> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/sessions/${id}`, {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<Session>(response);
};

export const getSpans = async (
  params: GetSpansParams = {},
): Promise<SpansResponse> => {
  const url = new URL(`${getBaseUrl()}/dashboard/api/spans`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<SpansResponse>(response);
};

export const getAnalytics = async (
  params: GetAnalyticsParams = {},
): Promise<AnalyticsResponse> => {
  const url = new URL(`${getBaseUrl()}/dashboard/api/analytics`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<AnalyticsResponse>(response);
};

export const getSpansAnalytics = async (
  params: GetSpansAnalyticsParams,
): Promise<SpansAnalyticsResponse> => {
  const url = new URL(`${getBaseUrl()}/dashboard/api/analytics/spans`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<SpansAnalyticsResponse>(response);
};

export const getSessionSpans = async (
  sessionId: string,
): Promise<SessionSpansResponse> => {
  const response = await fetch(
    `${getBaseUrl()}/dashboard/api/sessions/${sessionId}/spans`,
    {
      credentials: "include",
      headers: getProjectHeaders(),
    },
  );
  return handleResponse<SessionSpansResponse>(response);
};

export const createProject = async (
  name: string,
): Promise<CreateProjectResult> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/projects`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  return handleResponse<CreateProjectResult>(response);
};

export const getApiKeys = async (): Promise<ApiKeysResponse> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/api-keys`, {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<ApiKeysResponse>(response);
};

export const deleteApiKey = async (
  keyId: string,
): Promise<{ success: boolean }> => {
  const response = await fetch(
    `${getBaseUrl()}/dashboard/api/api-keys/${keyId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getProjectHeaders(),
    },
  );
  return handleResponse<{ success: boolean }>(response);
};

export const updateApiKeyName = async (
  keyId: string,
  name: string,
): Promise<{ success: boolean }> => {
  const response = await fetch(
    `${getBaseUrl()}/dashboard/api/api-keys/${keyId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getProjectHeaders(),
      },
      body: JSON.stringify({ name }),
    },
  );
  return handleResponse<{ success: boolean }>(response);
};

export const createApiKey = async (): Promise<{ apiKey: string }> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/api-keys`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getProjectHeaders(),
    },
  });
  return handleResponse<{ apiKey: string }>(response);
};

export const getProjectUsers = async (): Promise<ProjectUsersResponse> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/users`, {
    credentials: "include",
    headers: getProjectHeaders(),
  });
  return handleResponse<ProjectUsersResponse>(response);
};

export const createProjectUser = async (
  input: CreateProjectUserInput,
): Promise<{ user: ProjectUserInfo }> => {
  const response = await fetch(`${getBaseUrl()}/dashboard/api/users`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getProjectHeaders(),
    },
    body: JSON.stringify(input),
  });
  return handleResponse<{ user: ProjectUserInfo }>(response);
};
