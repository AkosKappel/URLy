export interface TabLike {
  url?: string;
  title?: string;
}

export interface Link {
  url: string;
  title: string;
}

export const FORMATS = {
  plain: 'Plain URLs',
  markdown: 'Markdown links',
  titled: 'Title and URL',
  html: 'HTML links',
  csv: 'CSV',
  json: 'JSON',
  custom: 'Custom template',
} as const;

export type CopyFormat = keyof typeof FORMATS;

export const DEFAULT_TEMPLATE = '{title}\\t{url}';

export function isCopyFormat(value: unknown): value is CopyFormat {
  return typeof value === 'string' && Object.hasOwn(FORMATS, value);
}

const COPYABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function isCopyable(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return COPYABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

// Click and campaign identifiers that ad and email platforms append to links.
const TRACKING_PARAM =
  /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|twclid|igshid|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok|vero_id|oly_enc_id|oly_anon_id)$/i;

export function removeTracking(url: string): string {
  const parsed = new URL(url);
  const keys = [...parsed.searchParams.keys()];
  if (!keys.some((key) => TRACKING_PARAM.test(key))) return url;
  for (const key of keys)
    if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  return parsed.href;
}

export function copyableLinks(tabs: TabLike[], { clean = false } = {}): Link[] {
  const seen = new Set<string>();
  const links: Link[] = [];
  for (const tab of tabs) {
    if (!isCopyable(tab.url)) continue;
    const url = clean ? removeTracking(tab.url) : tab.url;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ url, title: tab.title?.trim() || url });
  }
  return links;
}

function markdownLink({ url, title }: Link): string {
  const text = title.replace(/[\\[\]]/g, '\\$&');
  const href = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
  return `[${text}](${href})`;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const csvField = (text: string) =>
  /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

function fillTemplate(template: string, link: Link): string {
  const values: Record<string, string> = {
    '{title}': link.title,
    '{url}': link.url,
    '{host}': new URL(link.url).host,
    '\\t': '\t',
    '\\n': '\n',
  };
  return template.replace(
    /\{(?:title|url|host)\}|\\[tn]/g,
    (key) => values[key] ?? key,
  );
}

export function formatLinks(
  links: Link[],
  format: CopyFormat,
  template = DEFAULT_TEMPLATE,
): string {
  if (links.length === 0) return '';
  switch (format) {
    case 'plain':
      return links.map((link) => link.url).join('\n');
    case 'markdown':
      return links.map(markdownLink).join('\n');
    case 'titled':
      return links.map(({ title, url }) => `${title}\n${url}`).join('\n\n');
    case 'html':
      return [
        '<ul>',
        ...links.map(
          ({ title, url }) =>
            `  <li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></li>`,
        ),
        '</ul>',
      ].join('\n');
    case 'csv':
      return [
        'title,url',
        ...links.map(({ title, url }) => `${csvField(title)},${csvField(url)}`),
      ].join('\n');
    case 'json':
      return JSON.stringify(links, null, 2);
    case 'custom':
      return links.map((link) => fillTemplate(template, link)).join('\n');
  }
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
