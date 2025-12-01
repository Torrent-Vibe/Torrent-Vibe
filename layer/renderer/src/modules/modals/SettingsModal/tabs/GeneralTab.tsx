import {
  AppearanceSection,
  ChromeSearchSection,
  DataManagementSection,
  DesktopFeaturesSection,
  PollingSection,
} from './components'

export const GeneralTab = () => {
  return (
    <div className="space-y-4">
      <AppearanceSection />
      <PollingSection />
      {ELECTRON && <DesktopFeaturesSection />}
      {ELECTRON && <ChromeSearchSection />}
      <DataManagementSection />
    </div>
  )
}
