const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.20.10.2'],
  async rewrites() {
    return [
      {
        // Exclude /api/auth/ — handled by NextAuth route handler
        source: '/api/:path((?!auth/).*)',
        destination: `${process.env.BACKEND_URL || 'http://localhost:8001'}/api/:path`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
