/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'object.innei.in',
      },
    ],
  },
}

export default nextConfig
