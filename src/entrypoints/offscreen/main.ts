import { browser } from 'wxt/browser';
import {
  readClipboard,
  writeClipboard,
  type ClipboardContent,
} from '@/lib/copy';

// Chrome service workers have no DOM, so the background script asks this
// offscreen document to read and write the clipboard.
browser.runtime.onMessage.addListener((message: unknown, _sender, respond) => {
  const request = message as { type?: string } & ClipboardContent;
  if (request.type === 'urly:write-clipboard') respond(writeClipboard(request));
  if (request.type === 'urly:read-clipboard') respond(readClipboard());
});
