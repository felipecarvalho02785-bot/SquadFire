/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A integração ClickUp (integracao/**) é Node puro, fora do bundle do Next.
  outputFileTracingExcludes: {
    '*': ['./design/**', './docs/**'],
  },
};

export default nextConfig;
