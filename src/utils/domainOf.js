// The site a URL points at, for a source link ("seriouseats.com"), or '' when
// it is not a URL.
export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
