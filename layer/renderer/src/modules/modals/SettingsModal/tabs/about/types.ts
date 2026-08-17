export interface AppInfo {
  author: string
  description: string
  name: string
  platform: string
  version: string
}

export interface DependencyInfo {
  license: string
  licenseText: string | null
  name: string
  repository: string | null
  version: string
}

export interface LicenseGroup {
  count: number
  license: string
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
  licenseGroups: LicenseGroup[]
  licenses: DependencyInfo[]
  totalLibraries: number
}

export interface LicenseStats {
  count: number
  license: string
  percentage: number
}

export interface AppInfoItem {
  isCommand?: boolean
  label: string
  value: string
}
