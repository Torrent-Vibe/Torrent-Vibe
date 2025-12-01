# Electron Logging Guide

This project uses `electron-log` for comprehensive logging throughout the update system and main process.

## Features

### Log Levels
- **Debug**: Detailed information for debugging (file only in production)
- **Info**: General information about application flow
- **Warn**: Warning messages for non-critical issues
- **Error**: Error messages for exceptions and failures

### Log Destinations
- **Console**: Development logs with colored output
- **File**: Persistent logs saved to disk
  - Main logs: `{userData}/logs/main.log`
  - Update logs: `{userData}/logs/update.log`

### Scoped Logging
Each service has its own logger scope for easy filtering:
- `UpdateService`: Update coordination and management
- `GithubUpdateService`: GitHub API and download operations
- `System`: System information and bootstrap logs

## Usage Examples

### Basic Logging
```typescript
import log from 'electron-log'

const logger = log.scope('MyService')

logger.info('Service started')
logger.debug('Debug information', { data: 'value' })
logger.warn('Warning message')
logger.error('Error occurred', error)
```

### Using the Config Helper
```typescript
import { getLogger } from '../config/log-config'

const logger = getLogger('MyService')
logger.info('Using configured logger')
```

## Update Service Logging

### UpdateService Logs
- Service initialization
- Version comparison and update detection
- Download progress and completion
- Extraction and verification status
- Renderer notification events

### GithubUpdateService Logs
- GitHub API requests and responses
- Authentication status (token presence/absence)
- Rate limit information and warnings
- Release information parsing
- Asset selection logic
- Download progress with byte counts
- Checksum verification results
- Error handling for network issues

## Log File Locations

In development:
- macOS: `~/Library/Logs/torrent-vibe/`
- Windows: `%USERPROFILE%\AppData\Roaming\torrent-vibe\logs\`
- Linux: `~/.config/torrent-vibe/logs/`

In production:
- Logs are written to the same locations but with production log levels

## Configuration

The logging system is configured in `src/config/log-config.ts`:

- **Console Level**: `debug` in development, `info` in production
- **File Level**: Always `debug` for comprehensive file logging
- **Max File Size**: 10MB with automatic rotation
- **Format**: Timestamp, level, scope, and message

## Environment Variables

### GitHub Token (Optional)
Set `GH_TOKEN` environment variable to authenticate GitHub API requests:
- Higher rate limits (5000 requests/hour vs 60 for unauthenticated)
- Access to private repositories if needed
- Better reliability for automated updates

```bash
export GH_TOKEN=ghp_your_github_token_here
```

## Debugging Tips

1. **Check Update Logs**: Look at `update.log` for all update-related operations
2. **Monitor Console**: Development console shows real-time logging
3. **Use Scopes**: Filter logs by service scope for focused debugging
4. **Enable Debug**: Set `NODE_ENV=development` for verbose console output
5. **GitHub Rate Limits**: Monitor rate limit warnings and consider setting GH_TOKEN

## Example Log Output

```
[14:30:15.123] [info] UpdateService Starting update check and preparation
[14:30:15.124] [debug] UpdateService Checking for updates from owner/repo
[14:30:15.456] [info] GithubUpdateService Getting latest release for owner/repo
[14:30:15.457] [info] GithubUpdateService GitHub token available (ghp_1234...abcd)
[14:30:15.789] [debug] GithubUpdateService Making JSON request to: https://api.github.com/...
[14:30:15.790] [debug] GithubUpdateService Using authenticated GitHub API request
[14:30:16.012] [debug] GithubUpdateService GitHub API rate limit remaining: 4999
[14:30:16.013] [info] GithubUpdateService Found release version: 1.2.3
[14:30:16.014] [debug] GithubUpdateService Release assets count: 3
```
