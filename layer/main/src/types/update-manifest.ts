import semver from 'semver'

export interface UpdateManifest {
  version: string
  asset_name: string
  asset_size: number
  asset_sha256: string
  required_main_hash?: string
  created_at: string
}

const HEX64 = /^[a-f0-9]{64}$/i

export function parseAndValidateUpdateManifest(input: unknown): UpdateManifest {
  if (typeof input !== 'object' || input == null) {
    throw new Error('Manifest is not an object')
  }

  const obj = input as Record<string, unknown>

  const versionRaw = obj.version
  const version = String(versionRaw ?? '')
  if (!version || !semver.valid(semver.coerce(version) || '')) {
    throw new Error(`Invalid manifest.version: ${version}`)
  }

  const assetNameRaw = obj.asset_name
  const asset_name = String(assetNameRaw ?? '')
  if (!asset_name) {
    throw new Error('Invalid manifest.asset_name: empty')
  }

  const asset_sizeRaw = obj.asset_size
  const asset_size = Number(asset_sizeRaw)
  if (!Number.isFinite(asset_size) || asset_size <= 0) {
    throw new Error(`Invalid manifest.asset_size: ${asset_sizeRaw}`)
  }

  const assetShaRaw = obj.asset_sha256
  const asset_sha256 = String(assetShaRaw ?? '')
  if (!HEX64.test(asset_sha256)) {
    throw new Error('Invalid manifest.asset_sha256 (must be 64-hex)')
  }

  const requiredMainHashRaw = obj.required_main_hash
  const required_main_hash =
    requiredMainHashRaw == null ? undefined : String(requiredMainHashRaw)
  if (required_main_hash != null && !HEX64.test(required_main_hash)) {
    throw new Error(
      'Invalid manifest.required_main_hash (must be 64-hex when present)',
    )
  }

  const createdAtRaw = obj.created_at
  const created_at = String(createdAtRaw ?? '')
  const createdDate = new Date(created_at)
  if (!created_at || Number.isNaN(createdDate.getTime())) {
    throw new Error('Invalid manifest.created_at (must be ISO timestamp)')
  }

  return {
    version,
    asset_name,
    asset_size,
    asset_sha256: asset_sha256.toLowerCase(),
    required_main_hash: required_main_hash?.toLowerCase(),
    created_at: createdDate.toISOString(),
  }
}
