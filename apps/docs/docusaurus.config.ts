import { themes as prismThemes } from 'prism-react-renderer';
import type { Config }           from '@docusaurus/types';
import type * as Preset          from '@docusaurus/preset-classic';

const config: Config = {
  title:       'ForgePortal',
  tagline:     'The Internal Developer Portal that developers actually love.',
  favicon:     'img/favicon.svg',
  url:         'https://docs.forgeportal.dev',
  baseUrl:     '/',

  organizationName: 'forgeportal',
  projectName:      'forgeportal',
  deploymentBranch: 'gh-pages',
  trailingSlash:    false,

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales:       ['en'],
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath:          './sidebars.ts',
          editUrl:              'https://github.com/forgeportal/forgeportal/tree/master/apps/docs/',
          showLastUpdateTime:   true,
          showLastUpdateAuthor: true,
        },
        blog:  false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          lastmod:    'date',
          changefreq: 'weekly',
          priority:   0.5,
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode:               'light',
      disableSwitch:             false,
      respectPrefersColorScheme: true,
    },

    navbar: {
      title: 'ForgePortal',
      logo: {
        alt:     'ForgePortal Logo',
        src:     'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type:      'docSidebar',
          sidebarId: 'mainSidebar',
          position:  'left',
          label:     'Docs',
        },
        {
          href:     'https://github.com/forgeportal/forgeportal',
          label:    'GitHub',
          position: 'right',
        },
        {
          type:     'search',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started',    to: '/docs/getting-started/overview' },
            { label: 'Plugin Development', to: '/docs/plugin-development/overview' },
            { label: 'API Reference',      to: '/docs/api/overview' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub',     href: 'https://github.com/forgeportal/forgeportal' },
            { label: 'Issues',     href: 'https://github.com/forgeportal/forgeportal/issues' },
            { label: 'Discussions', href: 'https://github.com/forgeportal/forgeportal/discussions' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Changelog',     href: 'https://github.com/forgeportal/forgeportal/blob/master/CHANGELOG.md' },
            { label: 'License (MIT)', href: 'https://github.com/forgeportal/forgeportal/blob/master/LICENSE' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ForgePortal. Built with Docusaurus.`,
    },

    prism: {
      theme:               prismThemes.github,
      darkTheme:           prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'typescript', 'json', 'sql', 'docker'],
    },

    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
