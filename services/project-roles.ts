import type { ProjectRole } from "../db/schema";

/**
 * Normalize stored role values, including legacy values from older migrations.
 */
export function normalizeProjectRole(role: string | null | undefined): ProjectRole {
  if (role === "admin" || role === "owner") {
    return "admin";
  }
  return "user";
}
