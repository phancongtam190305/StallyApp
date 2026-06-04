// API base URL - empty string = same origin (monolith/dev mode)
// Set VITE_API_BASE_URL to backend URL when running split architecture
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
