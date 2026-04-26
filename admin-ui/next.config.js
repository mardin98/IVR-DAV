// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // firebase-admin y google-cloud no son browser-safe
  serverExternalPackages: ['firebase-admin', '@google-cloud/discoveryengine', '@google-cloud/firestore', '@google-cloud/storage'],
};
module.exports = nextConfig;
