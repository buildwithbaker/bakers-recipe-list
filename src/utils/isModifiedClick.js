// A click the browser should handle itself: new tab, new window, download, or
// anything but the primary button. Every in-app recipe link is a real
// <a href="/bakers-recipe-list/r/<slug>/"> whose click handler intercepts only
// a plain left click, so middle-click, Ctrl/Cmd-click and long-press keep
// behaving the way a link should.
export function isModifiedClick(e) {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}
