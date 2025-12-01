#!/usr/bin/env node

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * License compliance checker for production dependencies
 * Generates multiple license reports for compliance and app display
 */

const OUTPUT_DIR = 'docs/licenses'
const COMPLIANCE_FILE = path.join(OUTPUT_DIR, 'LICENSE_COMPLIANCE.md')
const APP_DISPLAY_FILE = path.join(OUTPUT_DIR, 'OPEN_SOURCE_LICENSES.md')
const JSON_FILE = path.join(OUTPUT_DIR, 'licenses.json')
const APP_JSON_FILE = path.join(OUTPUT_DIR, 'app-licenses.json')

// Common license categories for compliance assessment
const LICENSE_CATEGORIES = {
  PERMISSIVE: [
    'MIT',
    'BSD',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'Apache-2.0',
    'ISC',
    'Unlicense',
  ],
  COPYLEFT_WEAK: ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'],
  COPYLEFT_STRONG: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
  PROPRIETARY: ['Commercial', 'Proprietary'],
  UNKNOWN: ['UNKNOWN', 'UNLICENSED', ''],
}

function getLicenseCategory(license) {
  if (!license) return 'UNKNOWN'

  const normalizedLicense = license.toUpperCase()

  for (const [category, licenses] of Object.entries(LICENSE_CATEGORIES)) {
    if (licenses.some((l) => normalizedLicense.includes(l.toUpperCase()))) {
      return category
    }
  }

  return 'OTHER'
}

function getRiskLevel(category) {
  switch (category) {
    case 'PERMISSIVE': {
      return 'LOW'
    }
    case 'COPYLEFT_WEAK': {
      return 'MEDIUM'
    }
    case 'COPYLEFT_STRONG': {
      return 'HIGH'
    }
    case 'PROPRIETARY': {
      return 'HIGH'
    }
    case 'UNKNOWN': {
      return 'HIGH'
    }
    default: {
      return 'MEDIUM'
    }
  }
}

async function getPackageLicenseInfo(packageName, version) {
  try {
    // Try to get license info from npm registry
    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`

    console.info(`Fetching license info for ${packageName}@${version}...`)

    // Use curl to fetch package info from npm registry
    const response = execSync(`curl -s "${registryUrl}"`, { encoding: 'utf8' })
    const packageInfo = JSON.parse(response)

    let license = packageInfo.license || 'UNKNOWN'
    let licenseText = ''
    let repository = packageInfo.repository?.url || packageInfo.homepage || ''

    // Handle license objects
    if (typeof license === 'object') {
      license = license.type || 'UNKNOWN'
    }

    // Try to get license from local node_modules if available
    try {
      const nodeModulesPath = path.join(
        process.cwd(),
        'node_modules',
        packageName,
      )
      const packageJsonPath = path.join(nodeModulesPath, 'package.json')

      if (fs.existsSync(packageJsonPath)) {
        const localPackageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8'),
        )
        license = localPackageJson.license || license

        // Look for license files
        const licenseFiles = [
          'LICENSE',
          'LICENSE.txt',
          'LICENSE.md',
          'LICENCE',
          'LICENCE.txt',
          'LICENCE.md',
        ]
        for (const licenseFile of licenseFiles) {
          const licenseFilePath = path.join(nodeModulesPath, licenseFile)
          if (fs.existsSync(licenseFilePath)) {
            licenseText = `${fs.readFileSync(licenseFilePath, 'utf8').slice(0, 500)}...`
            break
          }
        }
      }
    } catch {
      // Ignore local file errors
    }

    return {
      name: packageName,
      version,
      license: license || 'UNKNOWN',
      licenseText,
      repository,
      category: getLicenseCategory(license),
      riskLevel: getRiskLevel(getLicenseCategory(license)),
    }
  } catch (error) {
    console.error(`Error fetching license for ${packageName}: ${error.message}`)
    return {
      name: packageName,
      version,
      license: 'UNKNOWN',
      licenseText: '',
      repository: '',
      category: 'UNKNOWN',
      riskLevel: 'HIGH',
    }
  }
}

async function main() {
  console.info('🔍 Starting license compliance check...')

  // Read package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json not found in current directory')
    process.exit(1)
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const dependencies = packageJson.dependencies || {}

  console.info(
    `📦 Found ${Object.keys(dependencies).length} production dependencies`,
  )

  // Get license info for all dependencies
  const licenseInfos = []

  for (const [packageName, version] of Object.entries(dependencies)) {
    const cleanVersion = version.replace(/^[\^~]/, '').split('@')[0]
    const licenseInfo = await getPackageLicenseInfo(packageName, cleanVersion)
    licenseInfos.push(licenseInfo)

    // Add a small delay to avoid overwhelming the registry
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Sort by risk level and then by name
  licenseInfos.sort((a, b) => {
    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    const aRisk = riskOrder[a.riskLevel] || 1
    const bRisk = riskOrder[b.riskLevel] || 1

    if (aRisk !== bRisk) return aRisk - bRisk
    return a.name.localeCompare(b.name)
  })

  // Sort by name for app display (alphabetical for better UX)
  const appSortedInfos = [...licenseInfos].sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  // Generate all reports
  const complianceReport = generateComplianceReport(packageJson, licenseInfos)
  const appDisplayReport = generateAppDisplayReport(packageJson, appSortedInfos)
  const jsonData = generateJsonData(packageJson, licenseInfos)
  const appJsonData = generateAppJsonData(packageJson, appSortedInfos)

  // Write all files
  fs.writeFileSync(COMPLIANCE_FILE, complianceReport, 'utf8')
  fs.writeFileSync(APP_DISPLAY_FILE, appDisplayReport, 'utf8')
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf8')
  fs.writeFileSync(APP_JSON_FILE, JSON.stringify(appJsonData, null, 2), 'utf8')

  console.info(`✅ License reports generated:`)
  console.info(`   - Compliance report: ${COMPLIANCE_FILE}`)
  console.info(`   - App display report: ${APP_DISPLAY_FILE}`)
  console.info(`   - Raw JSON data: ${JSON_FILE}`)
  console.info(`   - App JSON data: ${APP_JSON_FILE}`)

  // Print summary
  const summary = generateSummary(licenseInfos)
  console.info(summary)
}

function generateSummary(licenseInfos) {
  const totalPackages = licenseInfos.length
  const riskCounts = licenseInfos.reduce((acc, info) => {
    acc[info.riskLevel] = (acc[info.riskLevel] || 0) + 1
    return acc
  }, {})

  const categoryCounts = licenseInfos.reduce((acc, info) => {
    acc[info.category] = (acc[info.category] || 0) + 1
    return acc
  }, {})

  return `
📊 License Compliance Summary:
- Total packages: ${totalPackages}
- High risk: ${riskCounts.HIGH || 0}
- Medium risk: ${riskCounts.MEDIUM || 0}
- Low risk: ${riskCounts.LOW || 0}

License categories:
- Permissive: ${categoryCounts.PERMISSIVE || 0}
- Weak Copyleft: ${categoryCounts.COPYLEFT_WEAK || 0}
- Strong Copyleft: ${categoryCounts.COPYLEFT_STRONG || 0}
- Unknown/Other: ${(categoryCounts.UNKNOWN || 0) + (categoryCounts.OTHER || 0)}
  `
}

function generateComplianceReport(packageJson, licenseInfos) {
  const timestamp = new Date().toISOString().split('T')[0]
  const totalPackages = licenseInfos.length

  let report = `# License Compliance Report

**Project:** ${packageJson.name || 'Unknown'}
**Version:** ${packageJson.version || 'Unknown'}
**Generated:** ${timestamp}
**Total Dependencies:** ${totalPackages}

## Summary

This document provides a comprehensive overview of all production dependencies and their associated licenses for compliance review.

### Risk Distribution

`

  // Add risk distribution table
  const riskCounts = licenseInfos.reduce((acc, info) => {
    acc[info.riskLevel] = (acc[info.riskLevel] || 0) + 1
    return acc
  }, {})

  report += `| Risk Level | Count | Percentage |\n`
  report += `|------------|-------|------------|\n`
  report += `| High | ${riskCounts.HIGH || 0} | ${(((riskCounts.HIGH || 0) / totalPackages) * 100).toFixed(1)}% |\n`
  report += `| Medium | ${riskCounts.MEDIUM || 0} | ${(((riskCounts.MEDIUM || 0) / totalPackages) * 100).toFixed(1)}% |\n`
  report += `| Low | ${riskCounts.LOW || 0} | ${(((riskCounts.LOW || 0) / totalPackages) * 100).toFixed(1)}% |\n`

  report += `\n### License Categories\n\n`

  const categoryCounts = licenseInfos.reduce((acc, info) => {
    acc[info.category] = (acc[info.category] || 0) + 1
    return acc
  }, {})

  report += `| Category | Count | Description |\n`
  report += `|----------|-------|-------------|\n`
  report += `| Permissive | ${categoryCounts.PERMISSIVE || 0} | MIT, BSD, Apache - Minimal restrictions |\n`
  report += `| Weak Copyleft | ${categoryCounts.COPYLEFT_WEAK || 0} | LGPL, MPL - Limited reciprocal obligations |\n`
  report += `| Strong Copyleft | ${categoryCounts.COPYLEFT_STRONG || 0} | GPL, AGPL - Strong reciprocal obligations |\n`
  report += `| Unknown/Other | ${(categoryCounts.UNKNOWN || 0) + (categoryCounts.OTHER || 0)} | Requires manual review |\n`

  // Add high-risk packages section
  const highRiskPackages = licenseInfos.filter(
    (info) => info.riskLevel === 'HIGH',
  )
  if (highRiskPackages.length > 0) {
    report += `\n## ⚠️ High Risk Packages\n\n`
    report += `The following packages require immediate attention:\n\n`

    for (const pkg of highRiskPackages) {
      report += `### ${pkg.name}@${pkg.version}\n`
      report += `- **License:** ${pkg.license}\n`
      report += `- **Category:** ${pkg.category}\n`
      report += `- **Repository:** ${pkg.repository}\n`
      report += `- **Risk Reason:** ${pkg.category === 'UNKNOWN' ? 'Unknown license requires manual review' : 'Copyleft or proprietary license'}\n\n`
    }
  }

  // Add complete dependency table
  report += `\n## Complete Dependency List\n\n`
  report += `| Package | Version | License | Category | Risk | Repository |\n`
  report += `|---------|---------|---------|----------|------|------------|\n`

  for (const info of licenseInfos) {
    const riskEmoji =
      info.riskLevel === 'HIGH'
        ? '🔴'
        : info.riskLevel === 'MEDIUM'
          ? '🟡'
          : '🟢'
    const repoLink = info.repository ? `[Link](${info.repository})` : 'N/A'

    report += `| ${info.name} | ${info.version} | ${info.license} | ${info.category} | ${riskEmoji} ${info.riskLevel} | ${repoLink} |\n`
  }

  // Add compliance recommendations
  report += `\n## Compliance Recommendations\n\n`
  report += `### Immediate Actions Required\n\n`

  if (highRiskPackages.length > 0) {
    report += `1. **Review High Risk Packages:** ${highRiskPackages.length} packages need immediate legal review\n`
    report += `2. **Unknown Licenses:** Manually verify license terms for packages with unknown licenses\n`
    report += `3. **Copyleft Compliance:** Ensure GPL/AGPL compliance requirements are met\n\n`
  } else {
    report += `✅ No high-risk packages detected. Continue with regular compliance monitoring.\n\n`
  }

  report += `### Best Practices\n\n`
  report += `- Run this report regularly (monthly/quarterly)\n`
  report += `- Review new dependencies before adding them\n`
  report += `- Maintain an approved license list\n`
  report += `- Consider using tools like FOSSA or Black Duck for continuous monitoring\n`
  report += `- Keep license documentation up to date\n\n`

  report += `### Legal Disclaimer\n\n`
  report += `This report is generated automatically and should not be considered legal advice. `
  report += `Please consult with legal counsel for definitive license compliance guidance.\n`

  report += `\n---\n`
  report += `*Report generated by license compliance checker on ${new Date().toLocaleString()}*\n`

  return report
}

function generateAppDisplayReport(packageJson, licenseInfos) {
  const timestamp = new Date().toISOString().split('T')[0]
  const totalPackages = licenseInfos.length

  let report = `# Open Source Licenses

**${packageJson.productName || packageJson.name}** uses the following open source libraries:

Generated on ${timestamp} • Total libraries: ${totalPackages}

---

`

  // Group by license type for better organization
  const licenseGroups = licenseInfos.reduce((acc, info) => {
    const { license } = info
    if (!acc[license]) {
      acc[license] = []
    }
    acc[license].push(info)
    return acc
  }, {})

  // Sort license groups by license name
  const sortedLicenseTypes = Object.keys(licenseGroups).sort()

  for (const licenseType of sortedLicenseTypes) {
    const packages = licenseGroups[licenseType]

    report += `## ${licenseType} License\n\n`

    for (const pkg of packages) {
      report += `### ${pkg.name}\n`
      report += `**Version:** ${pkg.version}  \n`
      if (pkg.repository) {
        const repoUrl = pkg.repository.replace('git+', '').replace('.git', '')
        report += `**Repository:** [${repoUrl}](${repoUrl})  \n`
      }
      report += `**License:** ${pkg.license}  \n`

      if (pkg.licenseText && pkg.licenseText.length > 10) {
        report += `\n<details>\n<summary>License Text</summary>\n\n\`\`\`\n${pkg.licenseText}\n\`\`\`\n\n</details>\n`
      }

      report += `\n---\n\n`
    }
  }

  report += `\n## Attribution\n\n`
  report += `This application is built with and depends on these excellent open source projects. `
  report += `We are grateful to all the developers and maintainers who contribute to the open source ecosystem.\n\n`

  report += `*This list was automatically generated and represents all production dependencies used in this application.*\n`

  return report
}

function generateJsonData(packageJson, licenseInfos) {
  return {
    project: {
      name: packageJson.name,
      productName: packageJson.productName,
      version: packageJson.version,
      repository: packageJson.repository,
    },
    generated: new Date().toISOString(),
    summary: {
      totalDependencies: licenseInfos.length,
      riskDistribution: licenseInfos.reduce((acc, info) => {
        acc[info.riskLevel] = (acc[info.riskLevel] || 0) + 1
        return acc
      }, {}),
      licenseCategories: licenseInfos.reduce((acc, info) => {
        acc[info.category] = (acc[info.category] || 0) + 1
        return acc
      }, {}),
    },
    dependencies: licenseInfos.map((info) => ({
      name: info.name,
      version: info.version,
      license: info.license,
      repository: info.repository,
      category: info.category,
      riskLevel: info.riskLevel,
      licenseText: info.licenseText,
    })),
  }
}

function generateAppJsonData(packageJson, licenseInfos) {
  return {
    appName: packageJson.productName || packageJson.name,
    appVersion: packageJson.version,
    generated: new Date().toISOString(),
    totalLibraries: licenseInfos.length,
    licenses: licenseInfos.map((info) => ({
      name: info.name,
      version: info.version,
      license: info.license,
      repository: info.repository
        ? info.repository.replace('git+', '').replace('.git', '')
        : null,
      licenseText: info.licenseText || null,
    })),
    licenseGroups: Object.entries(
      licenseInfos.reduce((acc, info) => {
        const { license } = info
        if (!acc[license]) {
          acc[license] = []
        }
        acc[license].push({
          name: info.name,
          version: info.version,
          repository: info.repository
            ? info.repository.replace('git+', '').replace('.git', '')
            : null,
        })
        return acc
      }, {}),
    ).map(([license, packages]) => ({
      license,
      count: packages.length,
      packages,
    })),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export {
  generateAppDisplayReport,
  generateAppJsonData,
  generateComplianceReport,
  generateJsonData,
  getPackageLicenseInfo,
}
