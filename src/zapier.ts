// Client for Zapier's Partner API (https://docs.api.zapier.com).
// Requires a client_id (free with any Zapier integration; not a secret — it
// ships in embed code). Parsing is deliberately defensive: field whitelists
// and array-vs-envelope fallbacks, since response shapes are only partially
// documented and this client is built to degrade gracefully, not crash.

function apiBase(): string {
  return (process.env.ZAPIER_API_BASE ?? "https://api.zapier.com").replace(/\/+$/, "");
}

function clientId(): string {
  const id = process.env.ZAPIER_CLIENT_ID;
  if (!id) {
    throw new Error(
      "ZAPIER_CLIENT_ID is not set. Any Zapier integration comes with a free client_id " +
        "(see https://docs.api.zapier.com for the Partner API setup); add it to this MCP " +
        'server\'s env config, e.g. "env": { "ZAPIER_CLIENT_ID": "..." }.',
    );
  }
  return id;
}

async function partnerGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${apiBase()}${path}`);
  url.searchParams.set("client_id", clientId());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(body.errors) ? body.errors.join("; ") : (body.message ?? `HTTP ${res.status}`);
    throw new Error(`Zapier Partner API error: ${detail}`);
  }
  return body;
}

/** Responses arrive either as bare arrays or {objects|results|apps: [...]} envelopes. */
export function itemsOf(body: any): any[] {
  if (Array.isArray(body)) return body;
  for (const key of ["objects", "results", "apps", "zap_templates"]) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export interface AppSummary {
  title?: string;
  slug?: string;
  description?: string;
  url?: string;
  categories?: string[];
}

export function shapeApp(raw: any): AppSummary {
  return {
    title: raw?.title,
    slug: raw?.slug ?? raw?.key,
    description: typeof raw?.description === "string" ? truncate(stripHtml(raw.description), 300) : undefined,
    url: raw?.url,
    categories: Array.isArray(raw?.categories)
      ? raw.categories.map((c: any) => (typeof c === "string" ? c : (c?.slug ?? c?.title))).filter(Boolean)
      : undefined,
  };
}

export interface TemplateSummary {
  title?: string;
  chain?: string;
  description?: string;
  create_url?: string;
  url?: string;
}

export function shapeTemplate(raw: any): TemplateSummary {
  const steps = Array.isArray(raw?.steps) ? raw.steps.map((s: any) => s?.title).filter(Boolean) : [];
  return {
    title: typeof raw?.title === "string" ? stripHtml(raw.title) : undefined,
    chain: steps.length ? steps.join(" → ") : undefined,
    description: typeof raw?.description === "string" ? truncate(stripHtml(raw.description), 300) : undefined,
    create_url: raw?.create_url,
    url: raw?.url,
  };
}

export async function searchApps(query: string | undefined, limit: number): Promise<AppSummary[]> {
  const params: Record<string, string> = { per_page: String(limit) };
  if (query) params.title_search = query;
  return itemsOf(await partnerGet("/v1/apps", params)).slice(0, limit).map(shapeApp);
}

export async function findZapTemplates(apps: string[], limit: number): Promise<TemplateSummary[]> {
  const params = { apps: apps.join(","), limit: String(limit) };
  return itemsOf(await partnerGet("/v1/zap-templates", params)).slice(0, limit).map(shapeTemplate);
}
