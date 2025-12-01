import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // License API configuration
    LICENSE_API_URL: z
      .url()
      .default('https://creem.qaq.wiki/v1/licenses/activate'),

    // GitHub API configuration
    REPO_OWNER: z.string().default('innei'),
    REPO_NAME: z.string().default('Torrent-Vibe-Private'),
    GH_TOKEN: z.string().optional(),

    // Database configuration
    DATABASE_URL: z.string().min(1, 'Database URL is required'),

    // Server configuration
    PORT: z.coerce.number().int().positive().default(15000),

    // Signing configuration
    SIGNING_ED25519_PRIVATE_KEY: z
      .string()
      .min(1, 'Signing ED25519 private key is required'),
    SIGNING_TTL_SECONDS: z.coerce.number().int().positive().default(604800), // 7 days
  },
  runtimeEnv: process.env,
})
