import { addExcludedDomains } from "@vibecodeapp/proxy";

/**
 * Keep participant email off the Vibecode proxy.
 *
 * `@vibecodeapp/proxy` replaces global fetch on import and rewrites any host on
 * its list to `<host>.cloudproxy.vibecodeapp.com`. `api.resend.com` is on that
 * list, so every pledge email from the desktop kiosk was being routed through
 * Vibecode's infrastructure rather than sent to Resend directly.
 *
 * Three reasons that is wrong here:
 *
 *   1. Privacy. These requests carry a participant's email address and their
 *      pledge photo. The tour deletes both as soon as the email is delivered,
 *      which is the whole point of the scrub — relaying them through a third
 *      party first defeats it.
 *   2. Reliability. The kiosk runs on a desktop in a venue, outside Vibecode
 *      entirely. Its ability to send mail should not depend on a proxy nobody
 *      at that venue can diagnose or fix, and the rewrite happens in software,
 *      so changing networks does not rule it out.
 *   3. Legibility. Anything the proxy says comes back labelled as a Resend
 *      error, which sends you off replacing a key that was never the problem.
 *
 * The proxy exists so that Vibecode can supply keys for services like OpenAI.
 * Resend is not one of those: we hold our own key, so there is nothing to gain
 * by going through it. Excluding is the package's own documented mechanism for
 * "use your own API keys", so the import above still does its job for
 * everything else.
 */
export const DIRECT_EMAIL_DOMAINS = ["api.resend.com", "api.sendgrid.com"] as const;

// Exclusions are checked before the proxied-domain list, and the background
// refresh of that list does not clear them, so applying this once at startup
// holds for the life of the process.
addExcludedDomains([...DIRECT_EMAIL_DOMAINS]);
