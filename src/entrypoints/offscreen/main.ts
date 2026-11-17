import { browser } from 'wxt/browser';
import { writeClipboard, type ClipboardContent } from '@/lib/copy';

// Chrome service workers have no DOM, so the background script asks this
// offscreen document to write to the clipboard.
browser.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
  const request = message as { type?: string } & ClipboardContent;
  if (request.type !== 'urly:write-clipboard') return;
  respond(writeClipboard(request));
});
