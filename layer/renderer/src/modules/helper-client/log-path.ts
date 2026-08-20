export const HELPER_DATA_DIR_RELATIVE = '.local/share/torrent-vibe-helper'
export const HELPER_LOG_RELATIVE_PATH = 'logs/helper.log'

export const helperLogFilePath = (): string =>
  `~/${HELPER_DATA_DIR_RELATIVE}/${HELPER_LOG_RELATIVE_PATH}`
