import { fetch } from "expo/fetch";
import { BACKEND_URL } from "./backend-url";

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

// Error envelope: { error: { message, code } }
interface ApiErrorBody {
  error?: { message?: string; code?: string };
}

const baseUrl = BACKEND_URL;

/**
 * How long any one request may take before it is treated as "server not
 * reachable". Without a limit, a request to a desktop that is switched off
 * never fails: Tailscale drops the packets silently and the tablet sits on a
 * spinner for a minute or more instead of carrying on with its local copy.
 */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Error thrown for non-2xx responses. Exposes the backend `code`
 * (e.g. "PHOTO_NOT_AVAILABLE") and HTTP `status` so callers can branch.
 */
export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const request = async <T>(
  url: string,
  options: { method?: string; body?: string } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  // 1. Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json") ?? false;

  // 2. Non-OK: surface a typed ApiError with the backend error code.
  if (!response.ok) {
    let code: string | null = null;
    let message = `Request failed: ${response.status}`;
    if (isJson) {
      try {
        const body = (await response.json()) as ApiErrorBody;
        code = body.error?.code ?? null;
        message = body.error?.message ?? message;
      } catch {
        // ignore parse errors, keep default message
      }
    }
    throw new ApiError(message, response.status, code);
  }

  // 3. JSON responses: parse and unwrap { data }
  if (isJson) {
    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  // 4. Non-JSON: return undefined
  return undefined as T;
};

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: any) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: any) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
  patch: <T>(url: string, body: any) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
};
