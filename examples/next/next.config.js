// @ts-check

const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Nx-specific options
  nx: {},

  webpack: (config) => {
    // Ensure Next resolves .ts and .tsx files when .js imports are used
    config.resolve.extensions.push('.ts', '.tsx');

    // Tell Webpack: whenever you see a `.js` import, also look for a `.ts` file.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };

    return config;
  },
};

const plugins = [
  // Add more Next.js plugins if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);