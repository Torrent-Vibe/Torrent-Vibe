import { app } from 'electron'
import { join } from 'pathe'

export const getUserDataPath = () => app.getPath('userData')
export const getAppCacheDir = () => join(getUserDataPath(), 'AppCache')
export const getAppDatabaseDir = () => join(getUserDataPath(), 'AppDatabase')
