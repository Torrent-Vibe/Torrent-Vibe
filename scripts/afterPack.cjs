'use strict'

const { execFileSync } = require('node:child_process')
const { readdirSync } = require('node:fs')
const path = require('node:path')

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

function resolveElectronBinary(context) {
  const { appOutDir, electronPlatformName } = context
  const productName = context.packager.appInfo.productFilename

  if (electronPlatformName === 'darwin' || electronPlatformName === 'mas') {
    return path.join(appOutDir, `${productName}.app`)
  }
  if (electronPlatformName === 'win32') {
    return path.join(appOutDir, `${productName}.exe`)
  }
  // linux binaries are named after LinuxPackager.executableName
  // (sanitized lowercase package name), not the productName
  return path.join(appOutDir, context.packager.executableName)
}

module.exports = async function afterPack(context) {
  await flipFuses(resolveElectronBinary(context), {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })

  if (context.electronPlatformName !== 'darwin') { return }

  // identity: null means the only signature is Electron's ad-hoc one, and
  // flipping fuses + copying in extraFiles/asarUnpack invalidates the bundle's
  // CodeDirectory. Re-sign ad-hoc here (no cert) so both dmg and zip ship a
  // bundle that passes `codesign --verify --deep --strict` — Sparkle's
  // generate_appcast refuses any archive whose .app fails that check.
  const appName = readdirSync(context.appOutDir).find(entry => entry.endsWith('.app'))
  if (!appName) {
    throw new Error(`afterPack: no .app bundle found in ${context.appOutDir}`)
  }
  const appPath = path.join(context.appOutDir, appName)

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
}
