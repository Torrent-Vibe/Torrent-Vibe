import { env } from './env'

export interface PortalConfig {
  licenseApiUrl: string
  githubApiUrl: string
  repoOwner: string
  repoName: string
  githubToken?: string
  databaseUrl: string
  insecureTls: boolean
  port: number
  // Ed25519 signing
  signingPrivateKey: string
  signingTtlSeconds: number
}

export const config: PortalConfig = {
  licenseApiUrl: env.LICENSE_API_URL,
  githubApiUrl: 'https://api.github.com',
  repoOwner: env.REPO_OWNER,
  repoName: env.REPO_NAME,
  githubToken: env.GH_TOKEN,
  databaseUrl: env.DATABASE_URL,
  insecureTls: true,
  port: env.PORT,
  signingPrivateKey: env.SIGNING_ED25519_PRIVATE_KEY,
  signingTtlSeconds: env.SIGNING_TTL_SECONDS,
}
