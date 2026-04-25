/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse usa pdfjs-dist com workers/wasm — não deve ser bundlificado pelo Next.js
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
