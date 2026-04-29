/**
 * Color palette for providers - will cycle through these for any provider
 */
const PROVIDER_COLORS = [
  "#34d399", // emerald-400
  "#fb923c", // orange-400
  "#a78bfa", // violet-400
  "#60a5fa", // blue-400
  "#f472b6", // pink-400
  "#a3e635", // lime-400
  "#fbbf24", // amber-400
  "#22d3ee", // cyan-400
];

/**
 * Tailwind color classes for badges - maps to the color palette
 */
const PROVIDER_BADGE_CLASSES = [
  { bg: "bg-emerald-500/5", text: "text-emerald-400/70" },
  { bg: "bg-orange-500/5", text: "text-orange-400/70" },
  { bg: "bg-violet-500/5", text: "text-violet-400/70" },
  { bg: "bg-blue-500/5", text: "text-blue-400/70" },
  { bg: "bg-pink-500/5", text: "text-pink-400/70" },
  { bg: "bg-lime-500/5", text: "text-lime-400/70" },
  { bg: "bg-amber-500/5", text: "text-amber-400/70" },
  { bg: "bg-cyan-500/5", text: "text-cyan-400/70" },
];

/**
 * Generate a consistent color index for a provider based on its name.
 */
function getProviderColorIndex(provider: string): number {
  let hash = 0;
  for (let i = 0; i < provider.length; i++) {
    hash = provider.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % PROVIDER_COLORS.length;
}

/**
 * Generate a consistent color for a provider based on its name.
 * Returns a hex color code.
 */
export function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[getProviderColorIndex(provider)];
}

/**
 * Get Tailwind color classes for provider badges.
 * Returns an object with bg and text classes.
 */
export function getProviderBadgeClasses(provider: string): {
  bg: string;
  text: string;
} {
  return PROVIDER_BADGE_CLASSES[getProviderColorIndex(provider)];
}

/**
 * Format provider name for display.
 * Converts "openai" -> "Openai", "google-ai" -> "Google-ai"
 */
function formatProviderName(provider: string): string {
  if (!provider) return "Unknown";
  return provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
}

/**
 * Get display label for provider with special handling for known providers.
 */
export function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    openrouter: "OpenRouter",
    google: "Google",
    meta: "Meta",
    mistral: "Mistral",
    cohere: "Cohere",
  };

  return labels[provider.toLowerCase()] || formatProviderName(provider);
}
