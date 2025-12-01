import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import type {
  ApiTokenEncryption,
  ApiTokenSummary,
} from '../services/api-token-store'
import { ApiTokenStore } from '../services/api-token-store'

interface SetValuePayload {
  id: string
  value: string
  encryption: ApiTokenEncryption
}

export class ApiTokenIPCService extends IpcService {
  static override readonly groupName = 'apiTokens'

  private _store: ApiTokenStore = null!

  get store(): ApiTokenStore {
    if (!this._store) {
      this._store = ApiTokenStore.getInstance()
    }
    return this._store
  }

  @IpcMethod()
  listSlots(): ApiTokenSummary[] {
    return this.store.listSummaries()
  }

  @IpcMethod()
  getValue(_context: IpcContext, id: string): string | null {
    return this.store.getTokenValue(id)
  }

  @IpcMethod()
  setValue(_context: IpcContext, payload: SetValuePayload): ApiTokenSummary {
    const sanitizedId = payload.id.trim()
    const sanitizedValue = payload.value ?? ''
    const preferredEncryption = payload.encryption || 'plain'
    return this.store.setTokenValue(
      sanitizedId,
      sanitizedValue,
      preferredEncryption,
    )
  }

  @IpcMethod()
  clearValue(_context: IpcContext, id: string): ApiTokenSummary {
    const sanitizedId = id.trim()
    return this.store.clearTokenValue(sanitizedId)
  }
}
