declare global {
  interface Window {
    __PULSE_CONFIG?: {
      apiBaseUrl?: string;
    };
  }
}

function getRuntimeApiBaseUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.__PULSE_CONFIG?.apiBaseUrl;
}

export function getApiBaseUrl(): string {
  return (
    getRuntimeApiBaseUrl() ||
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000")
  );
}

export {};
