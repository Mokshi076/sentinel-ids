export const API = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3001";
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const r = await fetch(API + path, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (r.status === 401 && token) { localStorage.removeItem("token"); location.href = "/login"; }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || `Request failed (${r.status})`);
  return d as T;
}
