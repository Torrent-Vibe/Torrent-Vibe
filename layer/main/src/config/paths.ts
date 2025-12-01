import { app } from 'electron'
import { join } from 'pathe'

export const UPDATE_DIR_NAME = 'AppRenderUpdates'
export const UPDATE_CACHE_DIR_NAME = 'UpdateCache'
export const UPDATE_LOCK_FILENAME = 'update.lock'

export const getUserDataPath = () => app.getPath('userData')
export const getUpdateDir = () => join(getUserDataPath(), UPDATE_DIR_NAME)
export const getAppCacheDir = () => join(getUserDataPath(), 'AppCache')
export const getAppDatabaseDir = () => join(getUserDataPath(), 'AppDatabase')

export const getUpdateCacheDir = () =>
  join(getAppCacheDir(), UPDATE_CACHE_DIR_NAME)
export const getUpdateLockPath = () =>
  join(getAppCacheDir(), UPDATE_LOCK_FILENAME)
