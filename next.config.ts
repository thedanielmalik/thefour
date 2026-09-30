const isGitHubPages = process.env.NEXT_PUBLIC_BASE_PATH === '/thefour';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? '/thefour' : '',
  assetPrefix: isGitHubPages ? '/thefour/' : undefined,
  images: { unoptimized: true }
};

export default nextConfig;
