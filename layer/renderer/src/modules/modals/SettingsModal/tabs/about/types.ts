export interface AppInfo {
  name: string
  version: string
  description: string
  author: string
  platform: string
}

export interface DependencyInfo {
  name: string
  version: string
  license: string
  repository: string | null
  licenseText: string | null
}

export interface LicenseGroup {
  license: string
  count: number
  packages: Array<{
    name: string
    version: string
    repository: string | null
  }>
}

export interface AppLicenseData {
  appName: string
  appVersion: string
  generated: string
  totalLibraries: number
  licenses: DependencyInfo[]
  licenseGroups: LicenseGroup[]
}

export interface LicenseStats {
  license: string
  count: number
  percentage: number
}

export interface AppInfoItem {
  label: string
  value: string
  isCommand?: boolean
}
