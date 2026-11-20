/**
 * Our form POSTs only accept requests sent from this site. Browsers always
 * send an Origin header on a POST; a missing or different one is refused.
 * (Astro's own security.checkOrigin is also on; this check doesn't rely on it.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

/** Plain 403 for a cross-site POST. */
export function crossSiteResponse(): Response {
  return new Response('This form must be sent from the GHIC Stock Pitch Guide site.', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
