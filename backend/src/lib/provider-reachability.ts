/**
 * Can this computer actually talk to the email provider?
 *
 * A valid key from a verified account that still comes back "unauthorized"
 * means the reply is not the provider's. Antivirus that inspects secure
 * connections, a company firewall, a guest Wi-Fi login page, or a stale proxy
 * setting will all answer on the provider's behalf, and the result is
 * indistinguishable from a rejected key unless you look at the shape of the
 * reply.
 *
 * This sends a deliberately keyless request. Resend answers it with a specific
 * JSON error, which is proof the connection reached Resend and nothing else.
 * Anything else in the reply is the thing blocking the email — and because no
 * key is involved, the check is safe to run and safe to paste anywhere.
 */

/** Environment variables that silently redirect outbound requests in Bun. */
const PROXY_VARIABLES = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
  "NO_PROXY",
  "no_proxy",
];

/** Longest reply fragment worth quoting back to a non-technical reader. */
const SNIPPET_LIMIT = 300;

export interface ProxyVariable {
  name: string;
  /** Credentials stripped: proxy URLs frequently carry a username and password. */
  value: string;
}

export interface ReachabilityResult {
  provider: "Resend";
  endpoint: string;
  /** True only when the provider itself answered. */
  reachedProvider: boolean;
  verdict: "clean" | "intercepted" | "no-connection";
  status: number | null;
  /** The `server:` response header, which names whoever answered. */
  serverHeader: string | null;
  bodySnippet: string;
  /** Network-level failure text, when the request never completed at all. */
  error: string | null;
  proxyVariables: ProxyVariable[];
}

/** Hide any user:password embedded in a proxy URL before it is displayed. */
function maskCredentials(value: string): string {
  return value.replace(/\/\/[^/@]*@/g, "//***@");
}

function readProxyVariables(): ProxyVariable[] {
  const found: ProxyVariable[] = [];
  for (const name of PROXY_VARIABLES) {
    const value = process.env[name];
    if (value && value.trim()) {
      found.push({ name, value: maskCredentials(value.trim()) });
    }
  }
  return found;
}

export async function checkResendReachable(): Promise<ReachabilityResult> {
  const endpoint = "https://api.resend.com/emails";
  const result: ReachabilityResult = {
    provider: "Resend",
    endpoint,
    reachedProvider: false,
    verdict: "no-connection",
    status: null,
    serverHeader: null,
    bodySnippet: "",
    error: null,
    proxyVariables: readProxyVariables(),
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      // No Authorization header on purpose. The reply we want is the one
      // Resend gives to a request carrying no key at all.
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    // Includes DNS blocks, refused connections, timeouts, and the certificate
    // errors thrown when something re-signs the connection with its own
    // certificate — itself a form of interception worth reporting.
    result.error = error instanceof Error ? error.message : "Unknown network error";
    result.verdict = "no-connection";
    return result;
  }

  result.status = response.status;
  result.serverHeader = response.headers.get("server");

  const body = (await response.text().catch(() => "")).trim();
  result.bodySnippet = body.length > SNIPPET_LIMIT ? `${body.slice(0, SNIPPET_LIMIT)}…` : body;

  // Resend's answer to a keyless request. Matched on the machine-readable
  // `name` rather than the prose, which providers reword over time.
  if (response.status === 401 && body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body) as { name?: unknown };
      if (parsed.name === "missing_api_key") {
        result.reachedProvider = true;
        result.verdict = "clean";
        return result;
      }
    } catch {
      // Not parseable, so not Resend's.
    }
  }

  result.verdict = "intercepted";
  return result;
}
