const isGitHubPages = process.env.NEXT_PUBLIC_BASE_PATH === '/thefour';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? '/thefour' : '',
  images: { unoptimized: true }
};

export default nextConfig;
