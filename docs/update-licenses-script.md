# License Update Script Documentation

## Overview

The `update-licenses.js` script is designed to automatically update the open source license information displayed in the AboutTab component of the Torrent Vibe application.

## Features

- ✅ Automatically scans all production dependencies from the renderer package
- ✅ Generates comprehensive license compliance reports
- ✅ Updates the JSON data file used by the AboutTab component
- ✅ Validates the generated license data
- ✅ Verifies AboutTab integration
- ✅ Provides detailed logging and error handling

## Usage

### Command Line

```bash
# Direct execution
node scripts/update-licenses.js

# Using npm/pnpm script
pnpm license:update
npm run license:update
```

### Integration with Build Process

You can integrate this script into your build process by adding it to the `prebuild` scripts in `package.json`:

```json
{
  "scripts": {
    "prebuild:electron": "pnpm run license:update && pnpm run native:build && pnpm run native:prepare && pnpm run security:prepare"
  }
}
```

## How It Works

1. **Dependency Analysis**: The script runs from the renderer directory (`layer/renderer`) to analyze the correct set of production dependencies that are actually used in the UI.

2. **License Data Generation**: It calls the existing `check-licenses.js` script with absolute path handling to ensure license files are generated in the correct location (`docs/licenses/`).

3. **Data Validation**: The script validates that the generated JSON file contains all required fields and has the expected structure.

4. **Integration Verification**: It checks that the AboutTab component properly imports and uses the license data.

## Generated Files

The script generates several files in the `docs/licenses/` directory:

- `app-licenses.json` - JSON data consumed by the AboutTab component
- `licenses.json` - Raw license data for compliance review
- `LICENSE_COMPLIANCE.md` - Detailed compliance report for legal review
- `OPEN_SOURCE_LICENSES.md` - Human-readable license information

## Output Example

```bash
🔄 Starting license update process...

ℹ️  Step 1: Checking existing license data...
ℹ️  Found existing license data with 58 libraries

ℹ️  Step 2: Running license compliance check...
✅ License check completed successfully

ℹ️  Step 3: Validating generated license data...
✅ License data validated successfully:
ℹ️    - App: @torrent-vibe/renderer v0.0.0
ℹ️    - Total libraries: 58
ℹ️    - License types: 4
ℹ️  License distribution:
ℹ️    - MIT: 54 packages (93%)
ℹ️    - Apache-2.0: 2 packages (3%)
ℹ️    - UNKNOWN: 1 packages (2%)
ℹ️    - GPL-3.0: 1 packages (2%)

ℹ️  Step 4: Checking AboutTab integration...
✅ License data import found in AboutTab component
✅ License data usage found in AboutTab component

✅ 🎉 License update process completed successfully!
```

## Error Handling

The script includes comprehensive error handling:

- **Network Failures**: Retries failed license lookups
- **File System Errors**: Graceful handling of file read/write issues
- **Validation Failures**: Clear error messages for data validation issues
- **Integration Problems**: Warnings for AboutTab integration issues

## Troubleshooting

### Script Reports Wrong Number of Dependencies

- Ensure you're running the script from the project root
- Check that `layer/renderer/package.json` contains the expected dependencies
- Verify that the renderer package has been properly installed (`pnpm install`)

### License Data Not Updating in UI

- Restart the development server after running the script
- Clear browser cache or hard refresh the application
- Check that the import path in AboutTab is correct

### High Risk Packages Detected

The script will report packages with:
- Unknown licenses (requires manual review)
- GPL licenses (may require compliance measures)
- Proprietary licenses (may require licensing agreements)

Review the compliance report (`docs/licenses/LICENSE_COMPLIANCE.md`) for detailed information.

## Integration with AboutTab

The AboutTab component automatically imports the generated license data:

```typescript
import licenseData from '../../../../../../../docs/licenses/app-licenses.json'
```

The component uses this data to:
- Display dependency statistics
- Show license distribution charts
- List individual packages and their licenses
- Calculate license compliance metrics

## Automation

For continuous integration, consider:

1. Running the script before each build
2. Committing the generated files to version control
3. Setting up automated compliance monitoring
4. Integrating with legal review processes

## Related Files

- `scripts/check-licenses.js` - Core license scanning functionality
- `layer/renderer/src/modules/modals/SettingsModal/tabs/AboutTab.tsx` - UI component
- `layer/renderer/src/modules/modals/SettingsModal/tabs/about/types.ts` - TypeScript types
- `docs/licenses/` - Generated license documentation
