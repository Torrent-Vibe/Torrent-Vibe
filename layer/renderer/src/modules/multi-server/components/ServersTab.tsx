import { PathMappingSection } from './PathMappingSection'
import { ServerManagementSection } from './ServerManagementSection'

export const ServersTab = () => {
  return (
    <div className="space-y-6">
      <ServerManagementSection />

      {ELECTRON && <PathMappingSection />}
    </div>
  )
}
