/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@openspace/shared'],
  webpack: (config) => {
    // Resolve .js imports to .ts files in the shared package (ESM convention)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
