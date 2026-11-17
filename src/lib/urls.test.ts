import { describe, expect, it } from 'vitest';
import {
  copyableLinks,
  extractUrls,
  formatLinks,
  isCopyable,
  isCopyFormat,
  removeTracking,
} from './urls';

describe('isCopyable', () => {
  it.each([
    ['https://example.com/', true],
    ['http://example.com/', true],
    ['file:///home/notes.txt', true],
    ['chrome://extensions/', false],
    ['about:blank', false],
    ['edge://settings', false],
    ['moz-extension://abc/popup.html', false],
    [undefined, false],
    ['not a url', false],
  ])('%s -> %s', (url, expected) => {
    expect(isCopyable(url)).toBe(expected);
  });
});

describe('isCopyFormat', () => {
  it('accepts known formats only', () => {
    expect(isCopyFormat('csv')).toBe(true);
    expect(isCopyFormat('toString')).toBe(false);
    expect(isCopyFormat(undefined)).toBe(false);
  });
});

describe('removeTracking', () => {
  it('drops tracking parameters and keeps the rest', () => {
    expect(
      removeTracking(
        'https://a.com/p?id=7&utm_source=x&UTM_Medium=y&fbclid=z#top',
      ),
    ).toBe('https://a.com/p?id=7#top');
  });

  it('leaves URLs without tracking parameters untouched', () => {
    const url = 'https://a.com/search?q=a+b&ref=home';
    expect(removeTracking(url)).toBe(url);
  });

  it('removes the query string when only tracking was there', () => {
    expect(removeTracking('https://a.com/?gclid=1')).toBe('https://a.com/');
  });
});

describe('copyableLinks', () => {
  it('drops internal pages and duplicates, keeping order', () => {
    const tabs = [
      { url: 'https://b.com/', title: 'B' },
      { url: 'chrome://newtab/' },
      { url: 'https://a.com/', title: '  ' },
      { url: 'https://b.com/' },
    ];
    expect(copyableLinks(tabs)).toEqual([
      { url: 'https://b.com/', title: 'B' },
      { url: 'https://a.com/', title: 'https://a.com/' },
    ]);
  });

  it('de-duplicates after removing tracking when cleaning', () => {
    const tabs = [
      { url: 'https://a.com/?utm_source=x' },
      { url: 'https://a.com/' },
    ];
    expect(
      copyableLinks(tabs, { clean: true }).map((link) => link.url),
    ).toEqual(['https://a.com/']);
  });
});

describe('formatLinks', () => {
  const links = [
    { url: 'https://a.com/', title: 'Site A' },
    {
      url: 'https://en.wikipedia.org/wiki/C_(lang)',
      title: 'C [lang], "best" <3',
    },
  ];

  it('returns an empty string for no links', () => {
    expect(formatLinks([], 'json')).toBe('');
  });

  it('formats plain URLs', () => {
    expect(formatLinks(links, 'plain')).toBe(
      'https://a.com/\nhttps://en.wikipedia.org/wiki/C_(lang)',
    );
  });

  it('formats Markdown links with escaping', () => {
    expect(formatLinks(links, 'markdown')).toBe(
      '[Site A](https://a.com/)\n[C \\[lang\\], "best" <3](https://en.wikipedia.org/wiki/C_%28lang%29)',
    );
  });

  it('formats title and URL blocks', () => {
    expect(formatLinks(links, 'titled')).toBe(
      'Site A\nhttps://a.com/\n\nC [lang], "best" <3\nhttps://en.wikipedia.org/wiki/C_(lang)',
    );
  });

  it('formats an HTML list with escaping', () => {
    expect(formatLinks(links, 'html')).toBe(
      [
        '<ul>',
        '  <li><a href="https://a.com/">Site A</a></li>',
        '  <li><a href="https://en.wikipedia.org/wiki/C_(lang)">C [lang], &#34;best&#34; &#60;3</a></li>',
        '</ul>',
      ].join('\n'),
    );
  });

  it('formats CSV with a header and quoted fields', () => {
    expect(formatLinks(links, 'csv')).toBe(
      'title,url\nSite A,https://a.com/\n"C [lang], ""best"" <3",https://en.wikipedia.org/wiki/C_(lang)',
    );
  });

  it('formats JSON', () => {
    expect(JSON.parse(formatLinks(links, 'json'))).toEqual(links);
  });

  it('fills a custom template per link', () => {
    expect(
      formatLinks(links.slice(0, 1), 'custom', '- {title} ({host})\\t{url}'),
    ).toBe('- Site A (a.com)\thttps://a.com/');
  });

  it('defaults the custom template to title, tab, URL', () => {
    expect(formatLinks(links.slice(0, 1), 'custom')).toBe(
      'Site A\thttps://a.com/',
    );
  });

  it('leaves unknown placeholders in templates alone', () => {
    expect(formatLinks(links.slice(0, 1), 'custom', '{date} {url}\\n')).toBe(
      '{date} https://a.com/\n',
    );
  });
});

describe('extractUrls', () => {
  it('finds URLs in free text and normalizes them', () => {
    expect(
      extractUrls('Read https://a.com and www.b.org/page, then http://c.io.'),
    ).toEqual(['https://a.com/', 'https://www.b.org/page', 'http://c.io/']);
  });

  it('handles Markdown, angle brackets and quotes', () => {
    expect(
      extractUrls('[x](https://a.com/x) <https://b.com> "https://c.com/?q=1"'),
    ).toEqual(['https://a.com/x', 'https://b.com/', 'https://c.com/?q=1']);
  });

  it('keeps balanced parentheses but drops a wrapping one', () => {
    expect(extractUrls('(see https://en.wikipedia.org/wiki/C_(lang))')).toEqual(
      ['https://en.wikipedia.org/wiki/C_(lang)'],
    );
  });

  it('de-duplicates and ignores non-links', () => {
    expect(
      extractUrls('https://a.com https://a.com/ example.com ftp://x.com www.'),
    ).toEqual(['https://a.com/']);
  });

  it('accepts localhost and rejects single-label hosts', () => {
    expect(extractUrls('http://localhost:3000/a http://intranet/')).toEqual([
      'http://localhost:3000/a',
    ]);
  });
});
