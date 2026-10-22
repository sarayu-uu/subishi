// Share a link: the phone's share sheet when there is one, otherwise copy it.
export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'manual';

export async function share(url: string, title: string, text: string): Promise<ShareResult> {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'cancelled'; } // closed the sheet: do nothing
  }
  try { await navigator.clipboard.writeText(url); return 'copied'; }
  catch { return 'manual'; } // no clipboard (old browser, http, permission): show the link to copy by hand
}
