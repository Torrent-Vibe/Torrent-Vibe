export enum ErrorCode {
  CONFIG_MISSING = 'CONFIG_MISSING',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  BAD_RESPONSE = 'BAD_RESPONSE',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  UNKNOWN = 'UNKNOWN',
}

export interface ServiceError extends Error {
  code: ErrorCode
  status?: number
  details?: unknown
}

export function createServiceError(
  code: ErrorCode,
  message: string,
  status?: number,
  details?: unknown,
): ServiceError {
  const err = new Error(message) as ServiceError
  err.code = code
  err.status = status
  err.details = details
  return err
}

export function isServiceError(error: unknown): error is ServiceError {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in (error as Record<string, unknown>) &&
    typeof (error as { code: unknown }).code === 'string'
  )
}

type AxiosLikeError = {
  response?: {
    status?: number
    data?: { message?: string }
    statusText?: string
  }
  code?: string
  message: string
}

export function mapUnknownError(
  error: unknown,
  fallbackMessage = 'Unknown error',
  fallbackCode: ErrorCode = ErrorCode.UNKNOWN,
): ServiceError {
  const e = error as Partial<AxiosLikeError> | undefined

  // Axios-like HTTP errors
  if (e && e.response && typeof e.response.status === 'number') {
    const { status } = e.response
    const remoteMessage =
      e.response.data?.message || e.response.statusText || fallbackMessage
    if (status === 404)
      return createServiceError(ErrorCode.NOT_FOUND, remoteMessage, status)
    if (status === 403)
      return createServiceError(
        ErrorCode.PERMISSION_DENIED,
        remoteMessage,
        status,
      )
    if (status === 409)
      return createServiceError(ErrorCode.ALREADY_EXISTS, remoteMessage, status)
    if (status === 422)
      return createServiceError(
        ErrorCode.VALIDATION_ERROR,
        remoteMessage,
        status,
      )
    if (status >= 500)
      return createServiceError(
        ErrorCode.EXTERNAL_API_ERROR,
        remoteMessage,
        status,
      )
    return createServiceError(
      ErrorCode.EXTERNAL_API_ERROR,
      remoteMessage,
      status,
    )
  }

  // Timeouts / network conditions (axios & node)
  const code = (e?.code || '').toString()
  const msg = e?.message || fallbackMessage
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(msg)) {
    return createServiceError(ErrorCode.TIMEOUT, msg)
  }
  if (
    /ENOTFOUND|ECONNRESET|EAI_AGAIN|network/i.test(code) ||
    /network/i.test(msg)
  ) {
    return createServiceError(ErrorCode.NETWORK_ERROR, msg)
  }

  return createServiceError(fallbackCode, msg || fallbackMessage)
}

export function mapGitHubApiError(
  error: unknown,
  username: string,
): ServiceError {
  const e = error as AxiosLikeError
  if (e.response) {
    const status = e.response.status || 0
    if (status === 404) {
      return createServiceError(
        ErrorCode.NOT_FOUND,
        `GitHub user ${username} does not exist or repository not found`,
        status,
      )
    }
    if (status === 403) {
      return createServiceError(
        ErrorCode.PERMISSION_DENIED,
        'GitHub Token insufficient permissions or collaborator limit reached',
        status,
      )
    }
    if (status === 422) {
      return createServiceError(
        ErrorCode.ALREADY_EXISTS,
        'GitHub user is already a collaborator or invitation already exists',
        status,
      )
    }
    const message =
      e.response.data?.message || e.response.statusText || 'GitHub API error'
    return createServiceError(
      ErrorCode.EXTERNAL_API_ERROR,
      `GitHub API error: ${status} - ${message}`,
      status,
    )
  }
  // Fallback to generic mapping
  return mapUnknownError(
    error,
    'GitHub invitation network error',
    ErrorCode.NETWORK_ERROR,
  )
}
