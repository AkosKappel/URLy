import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  zip: { excludeSources: ['store/**'] },
  targetBrowsers: ['chrome', 'edge', 'firefox'],
  manifest: ({ browser }) => ({
    name: 'URLy',
    description: 'Copy open tab URLs and open pasted links in one click.',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: { default_title: 'URLy' },
    permissions: [
      'tabs',
      'storage',
      'contextMenus',
      'clipboardWrite',
      ...(browser === 'firefox' ? [] : ['offscreen']),
    ],
    commands: {
      'copy-tabs': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Copy tab URLs without opening URLy',
      },
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+U' },
        description: 'Open URLy',
      },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: '{3b6f0f8e-5c1a-4d7e-9a2b-7c4e1d8f6a90}',
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
