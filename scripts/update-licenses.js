#!/usr/bin/env node
/* eslint-disable no-empty */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Script to update open source licenses in AboutTab
 * This script calls check-licenses.js to regenerate license data
 * and ensures the AboutTab component has the latest information
 */

const PROJECT_ROOT = path.resolve(__dirname, '..')
const LICENSE_JSON_PATH = path.join(
  PROJECT_ROOT,
  'docs/licenses/app-licenses.json',
)
const ELECTRON_LICENSE_JSON_PATH = path.join(
  PROJECT_ROOT,
  'docs/licenses/app-licenses-electron.json',
)
const ABOUT_TAB_PATH = path.join(
  PROJECT_ROOT,
  'layer/renderer/src/modules/modals/SettingsModal/tabs/AboutTab.tsx',
)

function logInfo(message) {
  console.info(`ℹ️  ${message}`)
}

function logSuccess(message) {
  console.info(`✅ ${message}`)
}

function logError(message) {
  console.error(`❌ ${message}`)
}

function logWarning(message) {
  console.warn(`⚠️  ${message}`)
}

async function checkLicenseDataExists() {
  if (!fs.existsSync(LICENSE_JSON_PATH)) {
    logWarning(`License data file not found at ${LICENSE_JSON_PATH}`)
    return false
  }

  try {
    const licenseData = JSON.parse(fs.readFileSync(LICENSE_JSON_PATH, 'utf8'))
    logInfo(
      `Found existing license data with ${licenseData.totalLibraries} libraries`,
    )
    return true
  } catch (error) {
    logError(`Failed to parse existing license data: ${error.message}`)
    return false
  }
}

function createTempScript(targetLabel) {
  const checkLicensesPath = path.join(PROJECT_ROOT, 'scripts/check-licenses.js')
  const originalScript = fs.readFileSync(checkLicensesPath, 'utf8')
  let modifiedScript = originalScript.replace(
    "const OUTPUT_DIR = 'docs/licenses'",
    `const OUTPUT_DIR = '${path.join(PROJECT_ROOT, 'docs/licenses')}'`,
  )

  if (targetLabel === 'electron') {
    // Change all output file names to electron-specific variants to avoid overwriting renderer files
    modifiedScript = modifiedScript
      .replace(
        "const COMPLIANCE_FILE = path.join(OUTPUT_DIR, 'LICENSE_COMPLIANCE.md')",
        "const COMPLIANCE_FILE = path.join(OUTPUT_DIR, 'LICENSE_COMPLIANCE-electron.md')",
      )
      .replace(
        "const APP_DISPLAY_FILE = path.join(OUTPUT_DIR, 'OPEN_SOURCE_LICENSES.md')",
        "const APP_DISPLAY_FILE = path.join(OUTPUT_DIR, 'OPEN_SOURCE_LICENSES-electron.md')",
      )
      .replace(
        "const JSON_FILE = path.join(OUTPUT_DIR, 'licenses.json')",
        "const JSON_FILE = path.join(OUTPUT_DIR, 'licenses-electron.json')",
      )
      .replace(
        "const APP_JSON_FILE = path.join(OUTPUT_DIR, 'app-licenses.json')",
        "const APP_JSON_FILE = path.join(OUTPUT_DIR, 'app-licenses-electron.json')",
      )
  }

  const tempScriptPath = path.join(
    PROJECT_ROOT,
    `scripts/temp-check-licenses-${targetLabel}.js`,
  )
  fs.writeFileSync(tempScriptPath, modifiedScript, 'utf8')
  return tempScriptPath
}

async function runLicenseCheck() {
  logInfo('Running license compliance check...')

  const originalCwd = process.cwd()
  try {
    // 1) Renderer dependencies
    const rendererDir = path.join(PROJECT_ROOT, 'layer/renderer')
    logInfo(`Running renderer license check from: ${rendererDir}`)
    const tempRenderer = createTempScript('renderer')
    process.chdir(rendererDir)
    const outRenderer = execSync(`node ${tempRenderer}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    })
    process.chdir(PROJECT_ROOT)
    fs.unlinkSync(tempRenderer)
    logSuccess('Renderer license check completed successfully')
    logInfo('Renderer output:')
    console.info(outRenderer)

    // 2) Electron (main) dependencies
    const mainDir = path.join(PROJECT_ROOT, 'layer/main')
    logInfo(`Running electron(main) license check from: ${mainDir}`)
    const tempMain = createTempScript('electron')
    process.chdir(mainDir)
    const outMain = execSync(`node ${tempMain}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    })
    process.chdir(PROJECT_ROOT)
    fs.unlinkSync(tempMain)
    logSuccess('Electron (main) license check completed successfully')
    logInfo('Electron(main) output:')
    console.info(outMain)

    return true
  } catch (error) {
    logError(`License check failed: ${error.message}`)
    if (error.stdout) console.info('STDOUT:', error.stdout)
    if (error.stderr) console.info('STDERR:', error.stderr)
    return false
  } finally {
    try {
      process.chdir(originalCwd)
    } catch {}
  }
}

async function validateLicenseData() {
  if (!fs.existsSync(LICENSE_JSON_PATH)) {
    logError('License data file was not generated')
    return false
  }

  try {
    const licenseData = JSON.parse(fs.readFileSync(LICENSE_JSON_PATH, 'utf8'))

    // Validate required fields
    const requiredFields = [
      'appName',
      'appVersion',
      'generated',
      'totalLibraries',
      'licenses',
      'licenseGroups',
    ]
    for (const field of requiredFields) {
      if (!(field in licenseData)) {
        logError(`Missing required field in license data: ${field}`)
        return false
      }
    }

    if (
      !Array.isArray(licenseData.licenses) ||
      licenseData.licenses.length === 0
    ) {
      logError('No licenses found in license data')
      return false
    }

    if (
      !Array.isArray(licenseData.licenseGroups) ||
      licenseData.licenseGroups.length === 0
    ) {
      logError('No license groups found in license data')
      return false
    }

    logSuccess(`License data validated successfully:`)
    logInfo(`  - App: ${licenseData.appName} v${licenseData.appVersion}`)
    logInfo(`  - Total libraries: ${licenseData.totalLibraries}`)
    logInfo(`  - License types: ${licenseData.licenseGroups.length}`)
    logInfo(
      `  - Generated: ${new Date(licenseData.generated).toLocaleString()}`,
    )

    // Show license distribution
    logInfo('License distribution:')
    licenseData.licenseGroups
      .sort((a, b) => b.count - a.count)
      .forEach((group) => {
        const percentage = Math.round(
          (group.count / licenseData.totalLibraries) * 100,
        )
        logInfo(
          `  - ${group.license}: ${group.count} packages (${percentage}%)`,
        )
      })

    return true
  } catch (error) {
    logError(`Failed to validate license data: ${error.message}`)
    return false
  }
}

async function validateElectronLicenseData() {
  if (!fs.existsSync(ELECTRON_LICENSE_JSON_PATH)) {
    logError('Electron (main) license data file was not generated')
    return false
  }

  try {
    const licenseData = JSON.parse(
      fs.readFileSync(ELECTRON_LICENSE_JSON_PATH, 'utf8'),
    )
    const requiredFields = [
      'appName',
      'appVersion',
      'generated',
      'totalLibraries',
      'licenses',
      'licenseGroups',
    ]
    for (const field of requiredFields) {
      if (!(field in licenseData)) {
        logError(`(Electron) Missing required field: ${field}`)
        return false
      }
    }

    if (!Array.isArray(licenseData.licenses)) {
      logError('(Electron) licenses must be an array')
      return false
    }

    logSuccess(`(Electron) License data validated successfully:`)
    logInfo(`  - App: ${licenseData.appName} v${licenseData.appVersion}`)
    logInfo(`  - Total libraries: ${licenseData.totalLibraries}`)
    logInfo(`  - License types: ${licenseData.licenseGroups.length}`)
    return true
  } catch (error) {
    logError(`Failed to validate Electron license data: ${error.message}`)
    return false
  }
}

async function checkAboutTabIntegration() {
  if (!fs.existsSync(ABOUT_TAB_PATH)) {
    logError(`AboutTab component not found at ${ABOUT_TAB_PATH}`)
    return false
  }

  try {
    const aboutTabContent = fs.readFileSync(ABOUT_TAB_PATH, 'utf8')

    // Check if the renderer license data import exists (allow any default import name)
    const importPattern = /import\s+\w+\s+from\s+['"](.*app-licenses\.json)['"]/
    const importMatch = aboutTabContent.match(importPattern)

    if (!importMatch) {
      logError('License data import not found in AboutTab component')
      return false
    }

    logSuccess('License data import found in AboutTab component')
    logInfo(`Import path: ${importMatch[1]}`)

    // Check if license data is being used (support new variable names)
    const usagePatterns = [
      /rendererLicenseData\s*&&\s*rendererLicenseData\.licenses/,
      /rendererLicenseData\.totalLibraries/,
      /electronLicenseData\s*&&\s*electronLicenseData\.licenses/,
      /electronLicenseData\.totalLibraries/,
      /calculateLicenseStats\((rendererLicenseData|electronLicenseData)\)/,
    ]

    let usageFound = 0
    for (const pattern of usagePatterns) {
      if (pattern.test(aboutTabContent)) {
        usageFound++
      }
    }

    if (usageFound === 0) {
      logWarning(
        'License data does not appear to be used in AboutTab component',
      )
      return false
    }

    logSuccess(
      `License data usage found in AboutTab component (${usageFound} patterns matched)`,
    )
    return true
  } catch (error) {
    logError(`Failed to check AboutTab integration: ${error.message}`)
    return false
  }
}

async function main() {
  console.info('🔄 Starting license update process...\n')

  // Step 1: Check if existing license data exists
  logInfo('Step 1: Checking existing license data...')
  await checkLicenseDataExists()
  console.info()

  // Step 2: Run license check to generate/update license data
  logInfo('Step 2: Running license compliance check...')
  const checkSuccess = await runLicenseCheck()
  if (!checkSuccess) {
    logError('License check failed. Aborting update process.')
    process.exit(1)
  }
  console.info()

  // Step 3: Validate the generated license data
  logInfo('Step 3: Validating generated license data...')
  const validationSuccess = await validateLicenseData()
  const validationElectronSuccess = await validateElectronLicenseData()
  if (!validationSuccess || !validationElectronSuccess) {
    logError('License data validation failed. Please check the generated data.')
    process.exit(1)
  }
  console.info()

  // Step 4: Check AboutTab integration
  logInfo('Step 4: Checking AboutTab integration...')
  const integrationSuccess = await checkAboutTabIntegration()
  if (!integrationSuccess) {
    logWarning(
      'AboutTab integration check failed. The component may need manual updates.',
    )
  }
  console.info()

  // Final summary
  logSuccess('🎉 License update process completed successfully!')
  logInfo('Summary:')
  logInfo('  ✅ License data generated and validated')
  if (integrationSuccess) {
    logInfo('  ✅ AboutTab component integration verified')
  } else {
    logWarning('  ⚠️ AboutTab integration requires attention (see logs above)')
  }
  logInfo('  📄 License files updated in docs/licenses/')
  logInfo(
    '\nThe AboutTab component should now display the latest open source license information.',
  )

  // Show next steps
  console.info('\n📋 Next steps:')
  console.info('  1. Review the updated license information in the app')
  console.info(
    '  2. Test the AboutTab in both development and production builds',
  )
  console.info(
    '  3. Commit the updated license files if everything looks correct',
  )
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logError(`Script execution failed: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
}

export { main as updateLicenses }
