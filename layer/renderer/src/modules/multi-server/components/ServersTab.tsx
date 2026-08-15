import { HelperBindingSection } from './HelperBindingSection'
import { PathMappingSection } from './PathMappingSection'
import { ServerManagementSection } from './ServerManagementSection'

export const ServersTab = () => {
  return (
    <div className="space-y-6">
      <ServerManagementSection />
      <HelperBindingSection />

      {ELECTRON && <PathMappingSection />}
    </div>
  )
}
