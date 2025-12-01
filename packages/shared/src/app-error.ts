export enum AppErrorCode {
  AppVersionTooLow = 'app-version-too-low',
  MainHashMissing = 'main-hash-missing',
}

export class AppError extends Error {
  public readonly code: AppErrorCode

  constructor(message: string, code: AppErrorCode) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export const isAppError = (error: unknown): error is AppError => {
  return (
    error instanceof Error &&
    'code' in (error as any) &&
    typeof (error as any).code === 'string'
  )
}
