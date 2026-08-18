/**
 * Origins this server should trust, for the desktop/self-hosted deployment.
 *
 * Two places need these and must agree, or you get the worst kind of bug:
 * the page loads but signing in silently fails.
 *   - Better Auth `trustedOrigins`
 *   - the CORS middleware in src/index.ts
 *
 * Why compute the LAN addresses instead of using a wildcard: Better Auth's
 * `*` matches everything except a slash, so a pattern like
 * `http://192.168.*` also matches `http://192.168.1.42.evil.com`. Reading
 * the machine's own interfaces gives exact origins with no such gap, and it
 * re-reads on every boot, so a changed DHCP lease fixes itself.
 */
import { networkInterfaces } from "node:os";

/** Private IPv4 ranges plus Tailscale's 100.64.0.0/10 range. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  // Tailscale hands out 100.64.x – 100.127.x (CGNAT range).
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** This machine's private IPv4 addresses, e.g. ["192.168.1.42", "100.79.3.8"]. */
export function localIPv4Addresses(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal && isPrivateIPv4(a.address)) {
        out.push(a.address);
      }
    }
  }
  return [...new Set(out)];
}

/**
 * Exact http origins for reaching this server from another machine on the
 * same network — the office-computer case, and Tailscale before HTTPS is
 * turned on.
 */
export function localNetworkOrigins(port: number): string[] {
  return localIPv4Addresses().map((ip) => `http://${ip}:${port}`);
}

/**
 * Tailscale MagicDNS names look like `desktop.tailc0ffee.ts.net` and are
 * only issued by Tailscale, so a suffix match is safe here. Verified that
 * this does NOT match lookalikes such as `https://foo.ts.net.evil.com`.
 */
export const TAILSCALE_ORIGIN_PATTERN = "https://*.ts.net";
export const TAILSCALE_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net$/;
