export class RendererSecurityManager {
  private static instance: RendererSecurityManager | null = null
  static getInstance(): RendererSecurityManager {
    if (!this.instance) this.instance = new RendererSecurityManager()
    return this.instance
  }

  async validateFeatureAccess(feature: string): Promise<boolean> {
    try {
      // electron-ipc-decorator registers channel as `${group}:${method}` by default
      return await (window as any).ipcRenderer.invoke(
        'security:validateFeatureAccess',
        feature,
      )
    } catch (e) {
      console.warn('[security] validateFeatureAccess failed:', e)
      return false
    }
  }

  async getToken() {
    try {
      return await (window as any).ipcRenderer.invoke('security:getToken')
    } catch (e) {
      console.warn('[security] getToken failed:', e)
      return null
    }
  }
}
