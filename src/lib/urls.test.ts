import { describe, expect, it } from 'vitest';
import { copyableTabs, extractUrls, formatTabs, isCopyable } from './urls';

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

describe('copyableTabs', () => {
  it('drops internal pages and duplicate URLs, keeping order', () => {
    const tabs = [
      { url: 'https://b.com/' },
      { url: 'chrome://newtab/' },
      { url: 'https://a.com/' },
      { url: 'https://b.com/' },
    ];
    expect(copyableTabs(tabs).map((tab) => tab.url)).toEqual([
      'https://b.com/',
      'https://a.com/',
    ]);
  });
});

describe('formatTabs', () => {
  const tabs = [
    { url: 'https://a.com/', title: 'Site A' },
    { url: 'https://en.wikipedia.org/wiki/C_(lang)', title: 'C [lang]' },
    { url: 'https://untitled.com/', title: '  ' },
  ];

  it('formats plain URLs one per line', () => {
    expect(formatTabs(tabs, 'plain')).toBe(
      'https://a.com/\nhttps://en.wikipedia.org/wiki/C_(lang)\nhttps://untitled.com/',
    );
  });

  it('formats Markdown links with escaped titles and URLs', () => {
    expect(formatTabs(tabs, 'markdown')).toBe(
      [
        '[Site A](https://a.com/)',
        '[C \\[lang\\]](https://en.wikipedia.org/wiki/C_%28lang%29)',
        '[https://untitled.com/](https://untitled.com/)',
      ].join('\n'),
    );
  });

  it('returns an empty string when nothing is copyable', () => {
    expect(formatTabs([{ url: 'about:blank' }], 'plain')).toBe('');
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
