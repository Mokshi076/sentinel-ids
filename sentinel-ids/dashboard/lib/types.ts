export type Severity = "none" | "low" | "medium" | "high";
export interface FeedItem { id: string; ts: number; src_ip: string; label: string; risk: number; severity: Severity; anomaly: boolean }
export interface Tick { ts: number; total: number; threats: number; bySeverity: { high: number; medium: number; low: number }; byLabel: Record<string, number>; feed: FeedItem[] }
export interface Totals { total: number; threats: number; high: number; medium: number; low: number }
