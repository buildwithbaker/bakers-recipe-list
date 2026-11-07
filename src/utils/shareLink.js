// Share a URL with the system share sheet, or copy it when there is none.
// Failures are never silent: the caller's toast says what happened.
//   share sheet available -> use it; a cancel (AbortError) says nothing
//   any other share failure, or no share sheet -> copy, "Link copied"
//   clipboard missing or refused -> "Could not copy the link"
async function copyLink(url, toast) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast('Could not copy the link');
  }
}

export async function shareLink({ title, url, toast }) {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  await copyLink(url, toast);
}
