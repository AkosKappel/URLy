export interface TabLike {
  url?: string;
  title?: string;
}

export type CopyFormat = 'plain' | 'markdown';

const COPYABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function isCopyable(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return COPYABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function copyableTabs<T extends TabLike>(tabs: T[]): T[] {
  const seen = new Set<string>();
  return tabs.filter((tab) => {
    if (!isCopyable(tab.url) || seen.has(tab.url)) return false;
    seen.add(tab.url);
    return true;
  });
}

function markdownLink({ url = '', title }: TabLike): string {
  const text = (title?.trim() || url).replace(/[\\[\]]/g, '\\$&');
  const href = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
  return `[${text}](${href})`;
}

export function formatTabs(tabs: TabLike[], format: CopyFormat): string {
  return copyableTabs(tabs)
    .map((tab) => (format === 'markdown' ? markdownLink(tab) : tab.url))
    .join('\n');
}

const URL_CANDIDATE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?*_~]+$/;
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

// Strips sentence punctuation and closing brackets that are not part of the
// URL itself, so "(see https://a.com/x_(y))." keeps the balanced "(y)".
function trimCandidate(candidate: string): string {
  let url = candidate;
  for (;;) {
    const trimmed = url.replace(TRAILING_PUNCTUATION, '');
    const last = trimmed.at(-1) ?? '';
    const opener = CLOSERS[last];
    if (
      opener &&
      trimmed.split(opener).length <= trimmed.split(last).length - 1
    ) {
      url = trimmed.slice(0, -1);
      continue;
    }
    return trimmed;
  }
}

export function extractUrls(text: string): string[] {
  const urls = new Set<string>();
  for (const [match] of text.matchAll(URL_CANDIDATE)) {
    const candidate = trimCandidate(match);
    const withScheme = /^www\./i.test(candidate)
      ? `https://${candidate}`
      : candidate;
    try {
      const url = new URL(withScheme);
      if (url.hostname.includes('.') || url.hostname === 'localhost')
        urls.add(url.href);
    } catch {
      // Not a parseable URL; skip it.
    }
  }
  return [...urls];
}
