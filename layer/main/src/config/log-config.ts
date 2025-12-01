import { app } from 'electron'
import log from 'electron-log'
import { join } from 'pathe'

/**
 * Configure electron-log for the update services and other main process logging
 */
export function configureLogging() {
  // Set log level based on environment
  const isDev = process.env.NODE_ENV === 'development'
  log.transports.console.level = isDev ? 'debug' : 'info'
  log.transports.file.level = 'debug' // Always log debug to file

  // Configure file transport
  const logDir = join(app.getPath('logs'))
  log.transports.file.resolvePathFn = () => join(logDir, 'main.log')
  log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
  log.transports.file.format =
    '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}'

  // Configure console transport
  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {scope} {text}'

  log.transports.file.resolvePathFn = () => {
    return join(logDir, 'main.log')
  }

  log.info('Logging configured successfully')
  log.info(`Log directory: ${logDir}`)
  log.info(`Console level: ${log.transports.console.level}`)
  log.info(`File level: ${log.transports.file.level}`)
  log.info(`Development mode: ${isDev}`)
}

/**
 * Get a logger instance with proper scope
 */
export function getLogger(scope: string) {
  return log.scope(scope)
}

/**
 * Log system information for debugging
 */
export function logSystemInfo() {
  const logger = getLogger('System')

  logger.info('=== System Information ===')
  logger.info(`Platform: ${process.platform}`)
  logger.info(`Architecture: ${process.arch}`)
  logger.info(`Node.js version: ${process.version}`)
  logger.info(`Electron version: ${process.versions.electron}`)
  logger.info(`App version: ${app.getVersion()}`)
  logger.info(`User data path: ${app.getPath('userData')}`)
  logger.info(`Logs path: ${app.getPath('logs')}`)
  logger.info(`Temp path: ${app.getPath('temp')}`)
  logger.info('========================')
}
