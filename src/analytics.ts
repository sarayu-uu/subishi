// Vercel Web Analytics (cookie-free page views). Counts the landing page automatically, and each home opened from
// the map or list as its own page (/p/<id>). Query strings (map position, filters) are dropped before sending so
// the same page is counted once, not once per map position.
import { inject, pageview } from '@vercel/analytics';

export function startAnalytics() {
  inject({ beforeSend: (event) => ({ ...event, url: event.url.split('?')[0] }) });
}

export const trackHome = (id: string) => pageview({ route: '/p/[id]', path: `/p/${id}` });
