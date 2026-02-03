const path = require('path');

module.exports = {
  title: 'My Project',
  tagline: 'Documentation',
  url: 'https://your-site.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  staticDirectories: [path.resolve(__dirname, 'static')],
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  markdown: {
    format: 'md',
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: path.resolve(__dirname, 'docs'),
          routeBasePath: '/',
          sidebarPath: path.resolve(__dirname, 'sidebars.js'),
        },
        blog: false,
        theme: {
          customCss: path.resolve(__dirname, 'src/css/custom.css'),
        },
      },
    ],
  ],
};
