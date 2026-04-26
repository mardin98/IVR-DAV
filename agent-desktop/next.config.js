/** @type {import('next').NextConfig} */
const nextConfig = {
  // JsSIP usa módulos que no existen en servidor — excluir del bundle SSR
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'jssip'];
    }
    return config;
  },
};

module.exports = nextConfig;
