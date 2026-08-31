// Restrict production traffic to the canonical hosts. Preview and local traffic pass through.

const ALLOWED_HOSTS = new Set(['www.teasbench.com', 'teasbench.com']);

export default function middleware(request) {
  if (process.env.VERCEL_ENV !== 'production') return;

  const host = (request.headers.get('host') || '')
    .split(':')[0]
    .toLowerCase();

  if (ALLOWED_HOSTS.has(host)) return;

  // Avoid confirming that another deployment exists.
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
