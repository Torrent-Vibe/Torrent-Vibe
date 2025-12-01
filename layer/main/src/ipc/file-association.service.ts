import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { t } from '~/utils/i18n'

export class FileAssociationService extends IpcService {
  static override readonly groupName = 'fileAssociation'

  @IpcMethod()
  async repair(_context: IpcContext) {
    try {
      if (process.platform === 'darwin') {
        // On macOS, associations are defined in Info.plist (forge extendInfo)
        // Show guidance since runtime change is not supported
        return { ok: true, message: t('fileAssociation.repair.macos') }
      }
      if (process.platform === 'win32') {
        // On Windows, association is handled by the installer (Squirrel). At runtime we can only hint.
        return { ok: true, message: t('fileAssociation.repair.windows') }
      }
      // Linux (AppImage) usually relies on desktop integration and mimetype cache
      return { ok: true, message: t('fileAssociation.repair.linux') }
    } catch (e: unknown) {
      const error = e as Error
      return { ok: false, message: String(error?.message || e) }
    }
  }
}
