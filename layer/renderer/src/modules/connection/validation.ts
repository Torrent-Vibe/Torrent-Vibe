import { QBittorrentClient } from '~/shared/api/qbittorrent-client'

export interface ConnectionConfig {
  host: string
  port: number
  username: string
  password: string
  useHttps: boolean
  baseUrl?: string
}

export interface ValidationError {
  type: 'network' | 'auth' | 'unknown'
  message: string
}

export interface ValidationResult {
  success: boolean
  error?: ValidationError
}

// Validation error configurations
export const VALIDATION_ERRORS = {
  network: (host: string, port: number, useHttps: boolean) => ({
    type: 'network' as const,
    message: `Cannot reach qBittorrent server at ${useHttps ? 'https' : 'http'}://${host}:${port}`,
  }),
  auth: {
    type: 'auth' as const,
    message: 'Invalid username or password',
  },
  unknown: {
    type: 'unknown' as const,
    message: 'An unexpected error occurred',
  },
  connection: {
    type: 'unknown' as const,
    message: 'Failed to connect to qBittorrent server',
  },
} as const

// Error type detection patterns
const ERROR_PATTERNS = {
  network: ['fetch', 'network', 'Failed to fetch', 'ECONNREFUSED', 'timeout'],
  auth: ['401', '403', 'Unauthorized', 'Forbidden'],
} as const

// Detect error type from error message
const detectErrorType = (
  error: Error,
  config: ConnectionConfig,
): ValidationError => {
  const message = error.message.toLowerCase()

  // Check for network errors
  for (const pattern of ERROR_PATTERNS.network) {
    if (message.includes(pattern.toLowerCase())) {
      return VALIDATION_ERRORS.network(
        config.host,
        config.port,
        config.useHttps,
      )
    }
  }

  // Check for auth errors
  for (const pattern of ERROR_PATTERNS.auth) {
    if (message.includes(pattern.toLowerCase())) {
      return VALIDATION_ERRORS.auth
    }
  }

  // Default to unknown error
  return VALIDATION_ERRORS.unknown
}

/**
 * Validate connection to qBittorrent server
 * @param config Connection configuration
 * @returns Validation result with success status and optional error
 */
export const validateConnection = async (
  config: ConnectionConfig,
): Promise<ValidationResult> => {
  try {
    // Create a temporary client for validation
    const tempClient = QBittorrentClient.create(config)

    // Attempt to login
    const loginSuccess = await tempClient.login()

    return loginSuccess
      ? { success: true }
      : { success: false, error: VALIDATION_ERRORS.auth }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? detectErrorType(error, config)
          : VALIDATION_ERRORS.unknown,
    }
  }
}

/**
 * Create connection configuration from form data
 */
export const createConnectionConfig = (data: {
  host: string
  port?: number
  username: string
  password: string
  useHttps: boolean
  useCurrentPath?: boolean
}): ConnectionConfig => {
  return data.useCurrentPath
    ? {
        host: '',
        port: 443,
        username: data.username,
        password: data.password,
        useHttps: data.useHttps,
        baseUrl: '/',
      }
    : {
        host: data.host,
        port: data.port || 0,
        username: data.username,
        password: data.password,
        useHttps: data.useHttps,
      }
}
