import { createAuthClient } from "better-auth/react";
import { getApiBaseUrl } from "./runtime-config";

const API_BASE_URL = getApiBaseUrl();

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
});
