export interface GitHubInviteResult {
  success: boolean
  status: number
  message: string
}

export interface ErrorPayload {
  code: string
  status?: number
  details?: unknown
}

export interface ValidationResult {
  success: boolean
  message: string
  error?: ErrorPayload
  data?: {
    github?: GitHubInviteResult
    processingTime: number
  }
}
