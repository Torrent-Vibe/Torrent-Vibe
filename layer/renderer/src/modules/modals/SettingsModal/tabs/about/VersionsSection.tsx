import { useEffect, useState } from 'react'

import { ipcServices } from '~/lib/ipc-client'

export const VersionsSection = () => {
  const [appVersion, setAppVersion] = useState<string>('')
  const [appBuildTime, setAppBuildTime] = useState<string | null>(null)
  const [rendererVersion, setRendererVersion] = useState<string | null>(null)
  const [rendererSource, setRendererSource] = useState<
    'hot-update' | 'bundled' | 'dev'
  >('bundled')

  useEffect(() => {
    let mounted = true
    if (!ELECTRON) return
    ipcServices?.app.getVersions().then((v) => {
      if (!mounted) return
      setAppVersion(v.appVersion)
      setAppBuildTime(v.appBuildTime)
      setRendererVersion(v.rendererVersion)
      setRendererSource(v.rendererSource)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="space-y-2 mb-6 font-mono text-sm">
      <div className="flex">
        <span className="text-text-secondary w-64 shrink-0">App version:</span>
        <span className="text-text">{appVersion || '-'}</span>
      </div>
      {appBuildTime && (
        <div className="flex">
          <span className="text-text-secondary w-64 shrink-0">Build time:</span>
          <span className="text-text">
            {new Date(appBuildTime).toLocaleString()}
          </span>
        </div>
      )}
      <div className="flex">
        <span className="text-text-secondary w-64 shrink-0">
          Renderer version:
        </span>
        <span className="text-text">
          {rendererSource === 'dev'
            ? 'Dev server'
            : rendererVersion
              ? `${rendererVersion} (${rendererSource})`
              : 'Bundled renderer'}
        </span>
      </div>
    </div>
  )
}
