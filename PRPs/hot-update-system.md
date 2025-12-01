# Hot Update System for QBittorrent WebUI PRP

## Overview

Implement a comprehensive hot update system that enables secure, automated updates of the renderer layer without requiring full application reinstalls or restarts. The system uses a "bootstrapper + external code" architecture with encrypted update packages, manual changelog management, and a separate update distribution repository for enhanced security and version management.

The implementation leverages a dual-repository approach: the main repository (`innei/qb-client-webui`) handles development and main version releases, while a dedicated update center (`Torrent-Vibe/Renderer-Update-Center`) manages encrypted hot update distribution with manual changelog editing and automated CI/CD workflows.

Key features include application-wide unique encryption keys, multi-tier fallback mechanisms, GitHub Releases-based distribution, and complete backward compatibility with existing functionality.

## Research Context & Findings

### Existing Architecture Analysis

**Current Bootstrap System:**

- **Bootstrap Pattern**: `layer/main/src/manager/bootstrap.ts` - Centralized application initialization
  - WindowManager singleton with ContentLoader abstraction
  - SecurityService integration with initialization validation
  - Session configuration and IPC handler setup
  - Error handling with graceful fallback dialogs

- **Content Loader Interface**: `layer/main/src/manager/content-loader.ts` - `WindowContentLoader` interface
  - Development vs production path resolution
  - Preload script path management  
  - Dev server URL generation and health checking
  - Clean separation of concerns for content source determination

- **Window Management**: `layer/main/src/manager/window-manager.ts` - Singleton pattern
  - BrowserWindow lifecycle management
  - Content loader integration with options passing
  - Platform-specific configurations (macOS vibrancy, traffic lights)

**Current Build & CI/CD Patterns:**

- **Build System**: `electron.vite.config.ts` - Separate main/preload/renderer builds
  - Security obfuscation plugin integration
  - Development vs production environment handling
  - Dependency chunking and code splitting
  
- **GitHub Actions**: `.github/workflows/build.yml` - Multi-platform build matrix
  - Tag-triggered releases with manual platform selection
  - Build artifact generation and upload
  - Trial version build support

**Existing Service Patterns:**

- **Security Service**: Singleton pattern with initialization validation
- **IPC Services**: Modular service registration with automatic initialization
- **Storage Management**: Centralized with error handling and validation

### External Research Insights

#### Encryption & Security Best Practices
- **Node.js Crypto Module**: https://nodejs.org/api/crypto.html
  - RSA-OAEP for key encryption, AES-256-GCM for data encryption
  - Digital signatures with RSA-SHA256 for integrity verification
  - Secure random key generation with crypto.randomBytes()

- **Electron Security Guidelines**: https://www.electronjs.org/docs/tutorial/security
  - Context isolation and disabled node integration
  - Secure preload script patterns
  - Safe external resource loading practices

#### GitHub Actions & Repository Management
- **GitHub Releases API**: https://docs.github.com/en/rest/releases
  - Automated release creation with asset uploads
  - Repository dispatch events for cross-repo coordination
  - Artifact sharing between workflows

- **Cross-Repository Actions**: https://docs.github.com/en/actions/learn-github-actions/reusing-workflows
  - Repository dispatch patterns for triggering external builds
  - Artifact download from external repositories
  - Secure token management for cross-repo access

#### Update System Architecture
- **Electron Auto-Updater Alternatives**: Manual update systems for greater control
- **Package Integrity Verification**: SHA-256 hashing with signature validation
- **Fallback Strategies**: Multi-tier recovery with graceful degradation

### Key Dependencies Available

- **Node.js Built-ins**: `crypto`, `fs`, `path` for encryption and file operations
- **Electron 34.0.0**: Secure context, app.getPath for user data directory
- **Archiver 7.0.0**: ZIP package creation with compression
- **Unzipper**: Package extraction with stream handling
- **@octokit/rest 21.0.0**: GitHub API integration for release management

## Implementation Blueprint

### Repository Architecture

```
📦 Main Repository: innei/qb-client-webui
├── layer/main/src/
│   ├── manager/
│   │   ├── bootstrap.ts (✅ Minimal changes for hot update integration)
│   │   ├── content-loader.ts (✅ Existing interface remains unchanged)
│   │   ├── hot-content-loader.ts (🆕 Hot update ContentLoader implementation)  
│   │   └── update-manager.ts (🆕 Core update orchestration)
│   ├── services/
│   │   ├── package-decryption-service.ts (🆕 Client-side decryption)
│   │   ├── github-update-service.ts (🆕 Update center API integration)
│   │   └── key-management-service.ts (🆕 Application key management)
│   └── types/
│       └── hot-update.types.ts (🆕 Type definitions)
├── resources/keys/ (🆕 Application-wide encryption keys)
│   ├── app-decrypt-private.pem (Unique to application)
│   └── app-verify-public.pem (Signature verification)
└── .github/workflows/
    └── trigger-update.yml (🆕 Cross-repo build triggering)

📦 Update Center Repository: Torrent-Vibe/Renderer-Update-Center  
├── changelogs/ (🆕 Manual changelog management)
│   ├── template.md (Changelog template)
│   ├── v1.2.0.md (Example release changelog)
│   └── v1.2.1.md (Version-specific changelogs)
├── keys/ (🆕 Update center encryption keys)
│   ├── app-encrypt-public.pem (Pairs with client private key)
│   └── app-signing-public.pem (Signature generation)
├── scripts/ (🆕 Build and encryption automation)
│   ├── prepare-release.js (Manual changelog workflow)
│   ├── create-update-package.js (Package creation)
│   ├── encrypt-package.js (Encryption implementation)
│   └── generate-app-keys.js (Key generation utility)
├── client-keys/ (🆕 Keys for main repo deployment)
│   ├── app-decrypt-private.pem (Copy to main repo)
│   └── app-verify-public.pem (Copy to main repo)
└── .github/workflows/
    └── release.yml (🆕 Automated encrypted release creation)
```

### Hot Update Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Development Cycle (Main Repository)                    │
│     ├─ Code changes and testing                            │
│     ├─ Build renderer layer                                │
│     ├─ Trigger update center build via repository dispatch │
│     └─ Upload build artifacts                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
    ┌──────────────▼──────────────┐
    │  2. Manual Changelog (PR)   │
    │     ├─ Create release PR     │
    │     ├─ Edit changelog file   │
    │     ├─ Team review process   │
    │     └─ Merge triggers build  │
    └──────────────┬──────────────┘
                   │
    ┌──────────────▼──────────────┐
    │  3. Automated Build         │
    │     ├─ Download artifacts    │
    │     ├─ Create update ZIP     │
    │     ├─ Encrypt with app keys │
    │     ├─ Generate signatures   │
    │     └─ Create GitHub Release │
    └──────────────┬──────────────┘
                   │
    ┌──────────────▼──────────────┐
    │  4. Client Update Process   │
    │     ├─ Check for updates     │
    │     ├─ Download encrypted    │
    │     ├─ Verify signatures     │
    │     ├─ Decrypt with app keys │
    │     ├─ Extract and validate  │
    │     └─ Hot swap content      │
    └─────────────────────────────┘
```

### Encryption Architecture Design

```typescript
// Per-installation key pairs generated on first run
interface ClientKeyPair {
  public: string    // Registered with update center
  private: string   // Stored locally, rotated as needed
  rotatedAt: number
}

// Application-wide signing key used to verify packages
interface SigningKeySystem {
  public: string    // Clients use for verification
  private: string   // Update center uses for signing (GitHub Secret)
}

// Encrypted package structure
interface EncryptedPackageStructure {
  metadata: {
    version: string
    timestamp: string
    size: number
    algorithm: 'AES-256-GCM'
    keyAlgorithm: 'RSA-2048-OAEP'
    originalHash: string  // SHA-256 of original content
  }
  payload: string        // Base64 AES-encrypted ZIP content
  encryptedKey: string   // Base64 RSA-encrypted AES key
  iv: string            // Base64 initialization vector
  authTag: string       // Base64 GCM authentication tag
  signature: string     // Base64 RSA signature of entire structure
}
```

- **Key Rotation Flow**:
  1. `KeyManagementService` generates a unique RSA key pair on first launch and stores it in the user's data directory.
  2. The public key is registered with the update center which responds with client-specific encrypted payloads.
  3. When rotation is requested (e.g., during major updates), the service regenerates the pair and re-registers the new public key.

### Complete GitHub Actions Workflows

**Main Repository Trigger Workflow:**

```yaml
# File: innei/qb-client-webui/.github/workflows/trigger-update.yml
name: Trigger Update Package Build

on:
  workflow_run:
    workflows: ["🖥️ Build Desktop"]
    types: [completed]
    branches: [main]
  
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to build (e.g., 1.2.0)'
        required: true
        type: string
      force_update:
        description: 'Force update build even if version exists'
        required: false
        type: boolean
        default: false

env:
  NODE_VERSION: '20'

jobs:
  trigger-update-center:
    if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    
    steps:
      # 1. 确定版本号
      - name: Determine version
        id: version
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            VERSION="${{ inputs.version }}"
          else
            # 从 package.json 读取版本或使用 git tag
            VERSION=$(echo ${{ github.event.workflow_run.head_sha }} | cut -c1-7)
            VERSION="1.2.0-${VERSION}"  # 实际项目中需要从 package.json 读取
          fi
          
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "📦 Building update for version: $VERSION"

      # 2. 检查 renderer 构建产物
      - name: Verify renderer build artifacts
        run: |
          echo "🔍 Checking for renderer build artifacts..."
          echo "Workflow run ID: ${{ github.event.workflow_run.id }}"
          echo "Head SHA: ${{ github.event.workflow_run.head_sha }}"

      # 3. 触发更新中心构建
      - name: Trigger update center build
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.UPDATE_CENTER_DISPATCH_TOKEN }}
          repository: Torrent-Vibe/Renderer-Update-Center
          event-type: trigger-update-build
          client-payload: |
            {
              "version": "${{ steps.version.outputs.version }}",
              "source_repo": "${{ github.repository }}",
              "source_owner": "${{ github.repository_owner }}",
              "artifact_name": "renderer-build",
              "workflow_run_id": "${{ github.event.workflow_run.id }}",
              "commit_sha": "${{ github.event.workflow_run.head_sha || github.sha }}",
              "force_update": "${{ inputs.force_update || false }}"
            }

      # 4. 记录触发信息
      - name: Log trigger information
        run: |
          echo "🚀 Update center build triggered successfully"
          echo "📋 Version: ${{ steps.version.outputs.version }}"
          echo "🔗 Monitor progress: https://github.com/Torrent-Vibe/Renderer-Update-Center/actions"
          echo "📦 Payload sent to update center:"
          echo "  - Version: ${{ steps.version.outputs.version }}"
          echo "  - Source: ${{ github.repository }}"
          echo "  - Workflow Run: ${{ github.event.workflow_run.id }}"
```

**Update Center Release Workflow:**

```yaml
# File: Torrent-Vibe/Renderer-Update-Center/.github/workflows/release.yml
name: Build Encrypted Update Package

on:
  push:
    branches: [main]
    paths: ['changelogs/v*.md']  # 只有新增版本 changelog 才触发
  
  repository_dispatch:
    types: [trigger-update-build]  # 接收主仓库触发
    
  workflow_dispatch:  # 手动触发
    inputs:
      version:
        description: 'Version to build (e.g., 1.2.0)'
        required: true
        type: string
      source_repo:
        description: 'Source repository (owner/repo)'
        required: false
        default: 'innei/qb-client-webui'
        type: string
      workflow_run_id:
        description: 'Source workflow run ID for artifact download'
        required: false
        type: string
      force_rebuild:
        description: 'Force rebuild even if version exists'
        required: false
        type: boolean
        default: false

env:
  NODE_VERSION: '20'
  ENCRYPTION_TIMEOUT: 300000  # 5 minutes
  DOWNLOAD_TIMEOUT: 600000    # 10 minutes

jobs:
  detect-version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.detect.outputs.version }}
      changelog_path: ${{ steps.detect.outputs.changelog_path }}
      should_build: ${{ steps.detect.outputs.should_build }}
      source_repo: ${{ steps.detect.outputs.source_repo }}
      workflow_run_id: ${{ steps.detect.outputs.workflow_run_id }}
    
    steps:
      - name: Checkout update center
        uses: actions/checkout@v4
        with:
          fetch-depth: 10  # 检查最近的 changelog 变更

      - name: Detect version and source
        id: detect
        run: |
          SHOULD_BUILD="false"
          VERSION=""
          CHANGELOG_PATH=""
          SOURCE_REPO="innei/qb-client-webui"
          WORKFLOW_RUN_ID=""
          
          # 手动触发
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            VERSION="${{ inputs.version }}"
            SOURCE_REPO="${{ inputs.source_repo }}"
            WORKFLOW_RUN_ID="${{ inputs.workflow_run_id }}"
            CHANGELOG_PATH="changelogs/v${VERSION}.md"
            
            if [ ! -f "$CHANGELOG_PATH" ]; then
              echo "❌ Changelog file not found: $CHANGELOG_PATH"
              exit 1
            fi
            
            SHOULD_BUILD="true"
            
          # Repository dispatch 事件
          elif [ "${{ github.event_name }}" = "repository_dispatch" ]; then
            VERSION="${{ github.event.client_payload.version }}"
            SOURCE_REPO="${{ github.event.client_payload.source_repo }}"
            WORKFLOW_RUN_ID="${{ github.event.client_payload.workflow_run_id }}"
            CHANGELOG_PATH="changelogs/v${VERSION}.md"
            
            # 检查是否强制更新
            if [ "${{ github.event.client_payload.force_update }}" = "true" ]; then
              echo "🔄 Force update requested"
              SHOULD_BUILD="true"
            elif [ ! -f "$CHANGELOG_PATH" ]; then
              echo "⚠️ Changelog not found for version $VERSION: $CHANGELOG_PATH"
              echo "📝 Please create changelog first using: npm run prepare:release"
              exit 1
            else
              SHOULD_BUILD="true"
            fi
            
          # Push 事件：检测新增的 changelog 文件
          else
            CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
            NEW_CHANGELOG=$(echo "$CHANGED_FILES" | grep "^changelogs/v.*\.md$" | head -1)
            
            if [ -n "$NEW_CHANGELOG" ]; then
              VERSION=$(basename "$NEW_CHANGELOG" .md | sed 's/^v//')
              CHANGELOG_PATH="$NEW_CHANGELOG"
              SHOULD_BUILD="true"
              
              echo "✅ Detected new changelog: $NEW_CHANGELOG"
              echo "📦 Version: $VERSION"
            else
              echo "ℹ️ No new changelog detected, skipping build"
            fi
          fi
          
          # 输出结果
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "changelog_path=$CHANGELOG_PATH" >> $GITHUB_OUTPUT
          echo "should_build=$SHOULD_BUILD" >> $GITHUB_OUTPUT
          echo "source_repo=$SOURCE_REPO" >> $GITHUB_OUTPUT
          echo "workflow_run_id=$WORKFLOW_RUN_ID" >> $GITHUB_OUTPUT
          
          echo "📋 Detection Results:"
          echo "  Version: $VERSION"
          echo "  Should Build: $SHOULD_BUILD"
          echo "  Source Repo: $SOURCE_REPO"
          echo "  Workflow Run ID: $WORKFLOW_RUN_ID"
          echo "  Changelog Path: $CHANGELOG_PATH"

  build-encrypted-package:
    needs: detect-version
    if: needs.detect-version.outputs.should_build == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    permissions:
      contents: write  # 创建 Release 需要写权限

    steps:
      # 1. 检出更新中心代码
      - name: Checkout update center
        uses: actions/checkout@v4

      # 2. 设置 Node.js 环境
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      # 3. 安装依赖
      - name: Install dependencies
        run: |
          npm ci
          npm list --depth=0

      # 4. 验证必需文件存在
      - name: Validate required files
        run: |
          # 验证加密密钥
          if [ ! -f "keys/app-encrypt-public.pem" ]; then
            echo "❌ Encryption public key not found"
            exit 1
          fi
          
          if [ ! -f "keys/app-signing-public.pem" ]; then
            echo "❌ Signing public key not found"
            exit 1
          fi
          
          # 验证脚本文件
          REQUIRED_SCRIPTS=(
            "scripts/create-update-package.js"
            "scripts/encrypt-package.js"
            "scripts/generate-manifest.js"
            "scripts/encryption-service.js"
          )
          
          for script in "${REQUIRED_SCRIPTS[@]}"; do
            if [ ! -f "$script" ]; then
              echo "❌ Required script not found: $script"
              exit 1
            fi
          done
          
          echo "✅ All required files validated"

      # 5. 下载主仓库构建产物
      - name: Download renderer build from source repo
        if: needs.detect-version.outputs.workflow_run_id != ''
        uses: dawidd6/action-download-artifact@v3
        with:
          github_token: ${{ secrets.SOURCE_REPO_ACCESS_TOKEN }}
          workflow_run_id: ${{ needs.detect-version.outputs.workflow_run_id }}
          repo: ${{ needs.detect-version.outputs.source_repo }}
          name: renderer-build
          path: ./downloads/
          if_no_artifact_found: fail
        timeout-minutes: 10

      # 6. 验证和解压构建产物
      - name: Validate and extract build artifacts
        run: |
          DOWNLOAD_DIR="./downloads"
          
          if [ ! -d "$DOWNLOAD_DIR" ]; then
            echo "❌ Download directory not found: $DOWNLOAD_DIR"
            exit 1
          fi
          
          echo "📁 Contents of download directory:"
          ls -la "$DOWNLOAD_DIR"
          
          # 查找构建档案
          BUILD_ARCHIVE=$(find "$DOWNLOAD_DIR" -name "*.zip" -o -name "*.tar.gz" | head -1)
          
          if [ -z "$BUILD_ARCHIVE" ]; then
            echo "❌ No build archive found in downloads"
            find "$DOWNLOAD_DIR" -type f -exec file {} \;
            exit 1
          fi
          
          echo "✅ Found build archive: $BUILD_ARCHIVE"
          
          # 创建解压目录
          mkdir -p ./build-input
          
          # 解压构建产物
          if [[ "$BUILD_ARCHIVE" == *.zip ]]; then
            echo "📦 Extracting ZIP archive..."
            unzip -q "$BUILD_ARCHIVE" -d ./build-input/
          elif [[ "$BUILD_ARCHIVE" == *.tar.gz ]]; then
            echo "📦 Extracting TAR archive..."
            tar -xzf "$BUILD_ARCHIVE" -C ./build-input/
          else
            echo "❌ Unsupported archive format: $BUILD_ARCHIVE"
            exit 1
          fi
          
          # 验证必需文件
          REQUIRED_FILES=(
            "index.html"
            "assets"
          )
          
          for file in "${REQUIRED_FILES[@]}"; do
            if [ ! -e "./build-input/$file" ]; then
              echo "❌ Required file not found in build: $file"
              echo "📁 Build contents:"
              find ./build-input -type f | head -20
              exit 1
            fi
          done
          
          echo "✅ Build validation passed"
          echo "📊 Build size: $(du -sh ./build-input | cut -f1)"

      # 7. 创建更新包
      - name: Create update package
        run: |
          VERSION="${{ needs.detect-version.outputs.version }}"
          echo "📦 Creating update package for version: $VERSION"
          
          # 确保输出目录存在
          mkdir -p ./dist
          
          # 运行包创建脚本
          timeout ${{ env.ENCRYPTION_TIMEOUT }}s node scripts/create-update-package.js \
            --input ./build-input \
            --output ./dist \
            --version "$VERSION" \
            --verbose
          
          # 验证包创建成功
          PACKAGE_PATH="./dist/qb-webui-renderer-v${VERSION}.zip"
          if [ ! -f "$PACKAGE_PATH" ]; then
            echo "❌ Package creation failed: $PACKAGE_PATH not found"
            ls -la ./dist/
            exit 1
          fi
          
          echo "✅ Package created: $PACKAGE_PATH"
          echo "📊 Package size: $(du -sh "$PACKAGE_PATH" | cut -f1)"

      # 8. 加密更新包
      - name: Encrypt update package
        run: |
          VERSION="${{ needs.detect-version.outputs.version }}"
          PACKAGE_PATH="./dist/qb-webui-renderer-v${VERSION}.zip"
          ENCRYPTED_PATH="./dist/qb-webui-renderer-v${VERSION}-encrypted.json"
          
          echo "🔐 Encrypting update package..."
          echo "  Input: $PACKAGE_PATH"
          echo "  Output: $ENCRYPTED_PATH"
          
          # 运行加密脚本
          timeout ${{ env.ENCRYPTION_TIMEOUT }}s node scripts/encrypt-package.js \
            --input "$PACKAGE_PATH" \
            --output "$ENCRYPTED_PATH" \
            --public-key "./keys/app-encrypt-public.pem" \
            --signing-key-env "APP_SIGNING_PRIVATE_KEY" \
            --verbose
          
          # 验证加密成功
          if [ ! -f "$ENCRYPTED_PATH" ]; then
            echo "❌ Encryption failed: $ENCRYPTED_PATH not found"
            ls -la ./dist/
            exit 1
          fi
          
          # 验证加密包结构
          echo "🔍 Validating encrypted package structure..."
          node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('$ENCRYPTED_PATH', 'utf8'));
            const required = ['metadata', 'payload', 'encryptedKey', 'iv', 'authTag', 'signature'];
            const missing = required.filter(field => !pkg[field]);
            if (missing.length > 0) {
              console.error('❌ Missing required fields:', missing);
              process.exit(1);
            }
            console.log('✅ Encrypted package structure valid');
            console.log('📊 Encrypted size:', (Buffer.from(pkg.payload, 'base64').length / 1024 / 1024).toFixed(2), 'MB');
          "
        env:
          APP_SIGNING_PRIVATE_KEY: ${{ secrets.APP_SIGNING_PRIVATE_KEY }}

      # 9. 生成发布 manifest
      - name: Generate release manifest
        run: |
          VERSION="${{ needs.detect-version.outputs.version }}"
          ENCRYPTED_PATH="./dist/qb-webui-renderer-v${VERSION}-encrypted.json"
          MANIFEST_PATH="./dist/manifest.json"
          CHANGELOG_PATH="${{ needs.detect-version.outputs.changelog_path }}"
          
          echo "📋 Generating release manifest..."
          
          # 运行 manifest 生成脚本
          node scripts/generate-manifest.js \
            --version "$VERSION" \
            --encrypted-package "$ENCRYPTED_PATH" \
            --changelog "$CHANGELOG_PATH" \
            --output "$MANIFEST_PATH" \
            --github-repo "Torrent-Vibe/Renderer-Update-Center" \
            --verbose
          
          # 验证 manifest 生成成功
          if [ ! -f "$MANIFEST_PATH" ]; then
            echo "❌ Manifest generation failed"
            exit 1
          fi
          
          echo "✅ Manifest generated: $MANIFEST_PATH"
          echo "📋 Manifest contents:"
          cat "$MANIFEST_PATH" | jq .

      # 10. 读取和处理 changelog 内容
      - name: Prepare changelog for release
        id: changelog
        run: |
          CHANGELOG_PATH="${{ needs.detect-version.outputs.changelog_path }}"
          VERSION="${{ needs.detect-version.outputs.version }}"
          
          if [ -f "$CHANGELOG_PATH" ]; then
            echo "📖 Processing changelog: $CHANGELOG_PATH"
            
            # 处理 changelog 内容，转换为 GitHub Release 格式
            {
              echo "# QBittorrent WebUI Renderer Update v${VERSION}"
              echo ""
              # 移除 Markdown 标题层级，保持内容格式
              sed 's/^### /#### /g; s/^## /### /g; s/^# /## /g' "$CHANGELOG_PATH" | \
                sed 's/- ✅/- /g; s/- \[ \]/- /g'
              echo ""
              echo "---"
              echo ""
              echo "🔐 **Security**: This update package is encrypted and digitally signed."
              echo "📱 **Installation**: Updates are applied automatically by the application."
              echo "🔄 **Compatibility**: Compatible with QBittorrent WebUI v1.0.0 and later."
            } > changelog-release.txt
            
            echo "✅ Changelog processed for release"
          else
            echo "⚠️ Changelog file not found: $CHANGELOG_PATH"
            echo "Automated release for version ${VERSION}" > changelog-release.txt
          fi

      # 11. 创建 GitHub Release
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ needs.detect-version.outputs.version }}
          name: 'QBittorrent WebUI v${{ needs.detect-version.outputs.version }}'
          body_path: changelog-release.txt
          prerelease: ${{ contains(needs.detect-version.outputs.version, '-') }}
          make_latest: ${{ !contains(needs.detect-version.outputs.version, '-') }}
          files: |
            ./dist/qb-webui-renderer-v${{ needs.detect-version.outputs.version }}-encrypted.json
            ./dist/manifest.json
          generate_release_notes: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # 12. 更新版本信息文件
      - name: Update latest version info
        run: |
          VERSION="${{ needs.detect-version.outputs.version }}"
          
          # 确保 releases 目录存在
          mkdir -p releases/versions
          
          # 生成最新版本信息
          cat > releases/latest.json << EOF
          {
            "version": "$VERSION",
            "tag": "v$VERSION",
            "released_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "prerelease": $(echo '${{ contains(needs.detect-version.outputs.version, '-') }}' | tr '[:upper:]' '[:lower:]'),
            "download_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/releases/download/v$VERSION/qb-webui-renderer-v$VERSION-encrypted.json",
            "manifest_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/releases/download/v$VERSION/manifest.json",
            "changelog_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/blob/main/${{ needs.detect-version.outputs.changelog_path }}",
            "release_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/releases/tag/v$VERSION"
          }
          EOF
          
          # 生成版本特定信息
          cp releases/latest.json "releases/versions/v$VERSION.json"
          
          # 提交版本信息更新
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add releases/
          git diff --staged --quiet || {
            git commit -m "chore: update latest version info to v$VERSION [skip ci]"
            git push
          }
          
          echo "✅ Version info updated"

      # 13. 通知主仓库（可选）
      - name: Notify source repository
        if: needs.detect-version.outputs.workflow_run_id != ''
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.SOURCE_REPO_ACCESS_TOKEN }}
          repository: ${{ needs.detect-version.outputs.source_repo }}
          event-type: update-package-ready
          client-payload: |
            {
              "version": "${{ needs.detect-version.outputs.version }}",
              "download_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/releases/download/v${{ needs.detect-version.outputs.version }}/qb-webui-renderer-v${{ needs.detect-version.outputs.version }}-encrypted.json",
              "manifest_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/releases/download/v${{ needs.detect-version.outputs.version }}/manifest.json",
              "release_url": "https://github.com/Torrent-Vibe/Renderer-Update-Center/releases/tag/v${{ needs.detect-version.outputs.version }}",
              "success": true
            }

      # 14. 清理构建产物
      - name: Cleanup build artifacts
        if: always()
        run: |
          echo "🧹 Cleaning up build artifacts..."
          rm -rf ./downloads ./build-input
          rm -f changelog-release.txt
          
          # 保留加密包和 manifest 用于调试
          echo "📁 Remaining files in dist:"
          ls -la ./dist/ || echo "No dist directory"
          
          echo "✅ Cleanup completed"

  # 构建失败通知
  notify-failure:
    needs: [detect-version, build-encrypted-package]
    if: failure() && needs.detect-version.outputs.workflow_run_id != ''
    runs-on: ubuntu-latest
    
    steps:
      - name: Notify source repository of failure
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.SOURCE_REPO_ACCESS_TOKEN }}
          repository: ${{ needs.detect-version.outputs.source_repo }}
          event-type: update-package-failed
          client-payload: |
            {
              "version": "${{ needs.detect-version.outputs.version }}",
              "error": "Update package build failed",
              "workflow_url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
              "success": false
            }
```

### Detailed Encryption Implementation Scripts

**Package Creation Script:**

```javascript
#!/usr/bin/env node
// File: Torrent-Vibe/Renderer-Update-Center/scripts/create-update-package.js

const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')
const archiver = require('archiver')
const { program } = require('commander')

program
  .requiredOption('--input <path>', 'Input directory with build files')
  .requiredOption('--output <path>', 'Output directory')
  .requiredOption('--version <version>', 'Version string')
  .option('--verbose', 'Verbose output', false)
  .parse()

class UpdatePackageBuilder {
  constructor(options) {
    this.options = options
    this.verbose = options.verbose || false
  }

  log(message, force = false) {
    if (this.verbose || force) {
      console.log(`[PackageBuilder] ${message}`)
    }
  }

  async createUpdatePackage() {
    const { input, output, version } = this.options

    this.log(`📦 Creating update package v${version}`, true)
    this.log(`   Input: ${input}`)
    this.log(`   Output: ${output}`)

    // 确保输出目录存在
    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true })
      this.log(`📁 Created output directory: ${output}`)
    }

    const packagePath = path.join(output, `qb-webui-renderer-v${version}.zip`)

    // 验证输入目录
    await this.validateInputDirectory(input)

    // 创建包信息
    const packageInfo = await this.generatePackageInfo(input, version)

    // 创建 ZIP 包
    await this.createZipPackage(input, packagePath, packageInfo)

    // 验证创建的包
    await this.validateCreatedPackage(packagePath)

    this.log(`✅ Update package created successfully: ${packagePath}`, true)
    return packagePath
  }

  async validateInputDirectory(inputDir) {
    this.log(`🔍 Validating input directory: ${inputDir}`)

    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input directory not found: ${inputDir}`)
    }

    // 验证必需文件
    const requiredFiles = [
      'index.html',
      'assets'
    ]

    const missingFiles = requiredFiles.filter(file => {
      const filePath = path.join(inputDir, file)
      return !fs.existsSync(filePath)
    })

    if (missingFiles.length > 0) {
      throw new Error(`Missing required files in input directory: ${missingFiles.join(', ')}`)
    }

    // 统计文件信息
    const stats = this.getDirectoryStats(inputDir)
    this.log(`📊 Input directory stats:`)
    this.log(`   Files: ${stats.fileCount}`)
    this.log(`   Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)

    return stats
  }

  getDirectoryStats(dir) {
    let fileCount = 0
    let totalSize = 0

    const walkDir = (currentDir) => {
      const files = fs.readdirSync(currentDir)
      
      for (const file of files) {
        const filePath = path.join(currentDir, file)
        const stat = fs.statSync(filePath)
        
        if (stat.isDirectory()) {
          walkDir(filePath)
        } else {
          fileCount++
          totalSize += stat.size
        }
      }
    }

    walkDir(dir)
    return { fileCount, totalSize }
  }

  async generatePackageInfo(inputDir, version) {
    this.log(`📋 Generating package info for version ${version}`)

    const stats = this.getDirectoryStats(inputDir)
    const packageInfo = {
      version,
      buildTime: new Date().toISOString(),
      buildCommit: process.env.GITHUB_SHA || 'unknown',
      buildNumber: process.env.GITHUB_RUN_NUMBER || '0',
      buildWorkflow: process.env.GITHUB_WORKFLOW || 'local',
      packageStats: {
        fileCount: stats.fileCount,
        totalSize: stats.totalSize,
        compressedSize: null // Will be filled after compression
      },
      contents: {
        indexHtml: fs.existsSync(path.join(inputDir, 'index.html')),
        assetsDir: fs.existsSync(path.join(inputDir, 'assets')),
        hasManifest: fs.existsSync(path.join(inputDir, 'manifest.json'))
      }
    }

    this.log(`📊 Package info generated:`)
    this.log(`   Version: ${packageInfo.version}`)
    this.log(`   Build: ${packageInfo.buildCommit.substring(0, 7)}`)
    this.log(`   Files: ${packageInfo.packageStats.fileCount}`)

    return packageInfo
  }

  async createZipPackage(inputDir, outputPath, packageInfo) {
    this.log(`🗜️ Creating ZIP package: ${outputPath}`)

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', {
        zlib: { level: 9 } // 最高压缩级别
      })

      let bytesProcessed = 0

      output.on('close', () => {
        const compressedSize = archive.pointer()
        const compressionRatio = ((packageInfo.packageStats.totalSize - compressedSize) / packageInfo.packageStats.totalSize * 100).toFixed(1)
        
        this.log(`✅ ZIP package created successfully`)
        this.log(`📊 Compression stats:`)
        this.log(`   Original: ${(packageInfo.packageStats.totalSize / 1024 / 1024).toFixed(2)} MB`)
        this.log(`   Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`)
        this.log(`   Ratio: ${compressionRatio}% reduction`)
        
        resolve(compressedSize)
      })

      archive.on('error', reject)
      archive.on('progress', (progress) => {
        bytesProcessed = progress.fs.processedBytes
        if (this.verbose && progress.entries.processed % 100 === 0) {
          this.log(`📦 Processed ${progress.entries.processed} files (${(bytesProcessed / 1024 / 1024).toFixed(1)} MB)`)
        }
      })

      archive.pipe(output)

      // 添加所有构建文件
      this.log(`📁 Adding build files from: ${inputDir}`)
      archive.directory(inputDir, false)

      // 添加包信息文件
      archive.append(JSON.stringify(packageInfo, null, 2), { 
        name: 'package-info.json',
        comment: 'Update package metadata'
      })

      // 完成打包
      archive.finalize()
    })
  }

  async validateCreatedPackage(packagePath) {
    this.log(`🔍 Validating created package: ${packagePath}`)

    if (!fs.existsSync(packagePath)) {
      throw new Error(`Package file not created: ${packagePath}`)
    }

    const stats = fs.statSync(packagePath)
    if (stats.size === 0) {
      throw new Error(`Package file is empty: ${packagePath}`)
    }

    // 验证 ZIP 文件格式（简单检查）
    const buffer = fs.readFileSync(packagePath, { start: 0, end: 4 })
    const zipSignature = buffer.toString('hex')
    
    if (!zipSignature.startsWith('504b0304') && !zipSignature.startsWith('504b0506')) {
      throw new Error(`Invalid ZIP file format: ${packagePath}`)
    }

    this.log(`✅ Package validation passed`)
    this.log(`📊 Final package size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)

    return true
  }
}

// 执行构建
async function main() {
  try {
    const builder = new UpdatePackageBuilder(program.opts())
    await builder.createUpdatePackage()
    process.exit(0)
  } catch (error) {
    console.error('❌ Package creation failed:', error.message)
    if (program.opts().verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { UpdatePackageBuilder }
```

**Encryption Service Implementation:**

```javascript
// File: Torrent-Vibe/Renderer-Update-Center/scripts/encryption-service.js

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

class UpdatePackageEncryption {
  constructor(options = {}) {
    this.options = {
      keySize: 2048,           // RSA key size
      aesKeySize: 32,          // AES key size (256 bits)
      ivSize: 16,              // AES IV size (128 bits)
      algorithm: 'aes-256-gcm',
      hashAlgorithm: 'sha256',
      signatureAlgorithm: 'RSA-SHA256',
      ...options
    }
    
    this.verbose = options.verbose || false
  }

  log(message, force = false) {
    if (this.verbose || force) {
      console.log(`[Encryption] ${message}`)
    }
  }

  /**
   * 加密更新包
   * @param {string} packagePath - 原始包文件路径
   * @param {string} outputPath - 加密包输出路径
   * @param {string} publicKeyPath - 加密公钥路径
   * @param {string} signingPrivateKey - 签名私钥（PEM格式字符串）
   * @returns {Promise<Object>} 加密包信息
   */
  async encryptPackage(packagePath, outputPath, publicKeyPath, signingPrivateKey) {
    this.log(`🔐 Starting package encryption process`, true)
    this.log(`   Input: ${packagePath}`)
    this.log(`   Output: ${outputPath}`)
    this.log(`   Public Key: ${publicKeyPath}`)

    try {
      // 1. 验证输入
      await this.validateInputs(packagePath, publicKeyPath, signingPrivateKey)

      // 2. 读取文件和密钥
      const packageData = fs.readFileSync(packagePath)
      const publicKey = fs.readFileSync(publicKeyPath, 'utf8')

      this.log(`📊 Package size: ${(packageData.length / 1024 / 1024).toFixed(2)} MB`)

      // 3. 生成随机密钥和 IV
      const aesKey = crypto.randomBytes(this.options.aesKeySize)
      const iv = crypto.randomBytes(this.options.ivSize)
      
      this.log(`🔑 Generated AES key (${this.options.aesKeySize * 8} bits)`) 
      this.log(`🎲 Generated IV (${this.options.ivSize * 8} bits)`)

      // 4. AES 加密包内容
      const encryptionResult = this.encryptWithAES(packageData, aesKey, iv)
      this.log(`🔐 AES encryption completed`)

      // 5. RSA 加密 AES 密钥
      const encryptedKey = this.encryptAESKey(aesKey, publicKey)
      this.log(`🔑 RSA key encryption completed`)

      // 6. 创建加密包结构
      const encryptedPackage = this.createEncryptedPackage(
        packagePath, packageData, encryptionResult, encryptedKey, iv
      )

      // 7. 数字签名
      const signature = this.signPackage(encryptedPackage, signingPrivateKey)
      encryptedPackage.signature = signature
      this.log(`✍️ Digital signature created`)

      // 8. 保存加密包
      this.saveEncryptedPackage(encryptedPackage, outputPath)
      
      this.log(`✅ Package encryption completed successfully`, true)
      this.log(`📊 Encrypted package size: ${(JSON.stringify(encryptedPackage).length / 1024 / 1024).toFixed(2)} MB`)

      return {
        originalSize: packageData.length,
        encryptedSize: JSON.stringify(encryptedPackage).length,
        compressionRatio: (packageData.length - encryptionResult.encryptedPayload.length) / packageData.length * 100,
        metadata: encryptedPackage.metadata
      }

    } catch (error) {
      this.log(`❌ Encryption failed: ${error.message}`, true)
      throw error
    }
  }

  async validateInputs(packagePath, publicKeyPath, signingPrivateKey) {
    this.log(`🔍 Validating inputs...`)

    // 验证包文件
    if (!fs.existsSync(packagePath)) {
      throw new Error(`Package file not found: ${packagePath}`)
    }

    const packageStats = fs.statSync(packagePath)
    if (packageStats.size === 0) {
      throw new Error(`Package file is empty: ${packagePath}`)
    }

    // 验证公钥文件
    if (!fs.existsSync(publicKeyPath)) {
      throw new Error(`Public key file not found: ${publicKeyPath}`)
    }

    const publicKey = fs.readFileSync(publicKeyPath, 'utf8')
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      throw new Error(`Invalid public key format: ${publicKeyPath}`)
    }

    // 验证签名私钥
    if (!signingPrivateKey || typeof signingPrivateKey !== 'string') {
      throw new Error('Signing private key is required and must be a string')
    }

    if (!signingPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Invalid signing private key format')
    }

    // 测试密钥对兼容性
    try {
      crypto.createPublicKey(publicKey)
      crypto.createPrivateKey(signingPrivateKey)
    } catch (error) {
      throw new Error(`Key validation failed: ${error.message}`)
    }

    this.log(`✅ Input validation passed`)
  }

  encryptWithAES(data, key, iv) {
    this.log(`🔐 Performing AES-${this.options.aesKeySize * 8}-GCM encryption...`)
    
    const cipher = crypto.createCipherGCM(this.options.algorithm, key, iv)
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ])
    
    const authTag = cipher.getAuthTag()
    
    this.log(`   Encrypted payload: ${encrypted.length} bytes`)
    this.log(`   Auth tag: ${authTag.length} bytes`)
    
    return {
      encryptedPayload: encrypted,
      authTag: authTag
    }
  }

  encryptAESKey(aesKey, publicKey) {
    this.log(`🔑 Encrypting AES key with RSA...`)
    
    try {
      const encryptedKey = crypto.publicEncrypt({
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: this.options.hashAlgorithm
      }, aesKey)
      
      this.log(`   Encrypted key size: ${encryptedKey.length} bytes`)
      return encryptedKey
      
    } catch (error) {
      throw new Error(`RSA key encryption failed: ${error.message}`)
    }
  }

  createEncryptedPackage(originalPath, originalData, encryptionResult, encryptedKey, iv) {
    this.log(`📦 Creating encrypted package structure...`)
    
    const originalHash = crypto.createHash(this.options.hashAlgorithm)
      .update(originalData)
      .digest('hex')
    
    const encryptedPackage = {
      metadata: {
        version: this.extractVersionFromPath(originalPath),
        timestamp: new Date().toISOString(),
        size: originalData.length,
        algorithm: this.options.algorithm.toUpperCase(),
        keyAlgorithm: `RSA-${this.options.keySize}-OAEP`,
        hashAlgorithm: this.options.hashAlgorithm.toUpperCase(),
        originalHash: originalHash,
        encryptedSize: encryptionResult.encryptedPayload.length,
        compressionRatio: ((originalData.length - encryptionResult.encryptedPayload.length) / originalData.length * 100).toFixed(2)
      },
      payload: encryptionResult.encryptedPayload.toString('base64'),
      encryptedKey: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: encryptionResult.authTag.toString('base64')
    }
    
    this.log(`✅ Package structure created`)
    this.log(`📊 Metadata:`)
    this.log(`   Original size: ${(originalData.length / 1024 / 1024).toFixed(2)} MB`)
    this.log(`   Encrypted size: ${(encryptionResult.encryptedPayload.length / 1024 / 1024).toFixed(2)} MB`)
    this.log(`   Compression: ${encryptedPackage.metadata.compressionRatio}%`)
    
    return encryptedPackage
  }

  signPackage(encryptedPackage, signingPrivateKey) {
    this.log(`✍️ Creating digital signature...`)
    
    // 创建签名数据（不包含 signature 字段）
    const dataToSign = JSON.stringify({
      metadata: encryptedPackage.metadata,
      payload: encryptedPackage.payload,
      encryptedKey: encryptedPackage.encryptedKey,
      iv: encryptedPackage.iv,
      authTag: encryptedPackage.authTag
    })
    
    try {
      const signature = crypto.sign(this.options.signatureAlgorithm, Buffer.from(dataToSign), signingPrivateKey)
      
      this.log(`   Signature size: ${signature.length} bytes`)
      this.log(`   Signature algorithm: ${this.options.signatureAlgorithm}`)
      
      return signature.toString('base64')
      
    } catch (error) {
      throw new Error(`Digital signature creation failed: ${error.message}`)
    }
  }

  saveEncryptedPackage(encryptedPackage, outputPath) {
    this.log(`💾 Saving encrypted package to: ${outputPath}`)
    
    try {
      // 确保输出目录存在
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      
      // 保存加密包（格式化 JSON）
      const jsonString = JSON.stringify(encryptedPackage, null, 2)
      fs.writeFileSync(outputPath, jsonString, 'utf8')
      
      const fileSize = fs.statSync(outputPath).size
      this.log(`✅ Encrypted package saved (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
      
    } catch (error) {
      throw new Error(`Failed to save encrypted package: ${error.message}`)
    }
  }

  extractVersionFromPath(filePath) {
    const filename = path.basename(filePath)
    const versionMatch = filename.match(/v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?)/)
    return versionMatch ? versionMatch[1] : 'unknown'
  }

  /**
   * 验证加密包的完整性
   */
  async validateEncryptedPackage(encryptedPackagePath) {
    this.log(`🔍 Validating encrypted package: ${encryptedPackagePath}`)
    
    if (!fs.existsSync(encryptedPackagePath)) {
      throw new Error(`Encrypted package not found: ${encryptedPackagePath}`)
    }
    
    try {
      const packageContent = fs.readFileSync(encryptedPackagePath, 'utf8')
      const encryptedPackage = JSON.parse(packageContent)
      
      // 验证必需字段
      const requiredFields = ['metadata', 'payload', 'encryptedKey', 'iv', 'authTag', 'signature']
      const missingFields = requiredFields.filter(field => !encryptedPackage[field])
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
      }
      
      // 验证 base64 编码
      const base64Fields = ['payload', 'encryptedKey', 'iv', 'authTag', 'signature']
      for (const field of base64Fields) {
        try {
          Buffer.from(encryptedPackage[field], 'base64')
        } catch (error) {
          throw new Error(`Invalid base64 encoding in field: ${field}`)
        }
      }
      
      this.log(`✅ Encrypted package validation passed`)
      return true
      
    } catch (error) {
      throw new Error(`Encrypted package validation failed: ${error.message}`)
    }
  }
}

module.exports = { UpdatePackageEncryption }
```

**Package Encryption Script:**

```javascript
#!/usr/bin/env node
// File: Torrent-Vibe/Renderer-Update-Center/scripts/encrypt-package.js

const { UpdatePackageEncryption } = require('./encryption-service')
const { program } = require('commander')
const fs = require('node:fs')

program
  .requiredOption('--input <path>', 'Input package file (.zip)')
  .requiredOption('--output <path>', 'Output encrypted file (.json)')
  .requiredOption('--public-key <path>', 'Public key file path (.pem)')
  .requiredOption('--signing-key-env <name>', 'Environment variable containing signing private key')
  .option('--verbose', 'Verbose output', false)
  .parse()

class PackageEncryptor {
  constructor(options) {
    this.options = options
    this.encryption = new UpdatePackageEncryption({
      verbose: options.verbose
    })
  }

  async encryptPackage() {
    const { input, output, publicKey, signingKeyEnv, verbose } = this.options

    try {
      // 获取签名私钥
      const signingPrivateKey = process.env[signingKeyEnv]
      if (!signingPrivateKey) {
        throw new Error(`Signing private key not found in environment variable: ${signingKeyEnv}`)
      }

      if (verbose) {
        console.log('🔐 Package Encryption Process')
        console.log(`   Input Package: ${input}`)
        console.log(`   Output File: ${output}`)
        console.log(`   Public Key: ${publicKey}`)
        console.log(`   Signing Key: [ENVIRONMENT:${signingKeyEnv}]`)
      }

      // 验证输入文件
      if (!fs.existsSync(input)) {
        throw new Error(`Input package not found: ${input}`)
      }

      if (!fs.existsSync(publicKey)) {
        throw new Error(`Public key file not found: ${publicKey}`)
      }

      // 执行加密
      const result = await this.encryption.encryptPackage(
        input,
        output,
        publicKey,
        signingPrivateKey
      )

      // 验证加密结果
      await this.encryption.validateEncryptedPackage(output)

      // 输出结果信息
      console.log('\n✅ Package Encryption Summary:')
      console.log(`📦 Original Size: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`🔐 Encrypted Size: ${(result.encryptedSize / 1024 / 1024).toFixed(2)} MB`)
      console.log(`📊 Size Change: ${((result.encryptedSize - result.originalSize) / result.originalSize * 100).toFixed(1)}%`)
      console.log(`📁 Output File: ${output}`)
      console.log(`🔍 Version: ${result.metadata.version}`)
      console.log(`⏰ Timestamp: ${result.metadata.timestamp}`)

      return result

    } catch (error) {
      console.error('❌ Package encryption failed:', error.message)
      if (this.options.verbose) {
        console.error('🗂️ Stack trace:', error.stack)
      }
      throw error
    }
  }
}

// 执行加密
async function main() {
  try {
    const encryptor = new PackageEncryptor(program.opts())
    await encryptor.encryptPackage()
    
    console.log('\n🎉 Encryption process completed successfully!')
    process.exit(0)
    
  } catch (error) {
    console.error('\n💥 Encryption process failed!')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { PackageEncryptor }
```

**Manifest Generation Script:**

```javascript
#!/usr/bin/env node
// File: Torrent-Vibe/Renderer-Update-Center/scripts/generate-manifest.js

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { program } = require('commander')

program
  .requiredOption('--version <version>', 'Release version')
  .requiredOption('--encrypted-package <path>', 'Path to encrypted package file')
  .requiredOption('--changelog <path>', 'Path to changelog file')
  .requiredOption('--output <path>', 'Output manifest file path')
  .requiredOption('--github-repo <repo>', 'GitHub repository (owner/repo)')
  .option('--verbose', 'Verbose output', false)
  .parse()

class ManifestGenerator {
  constructor(options) {
    this.options = options
  }

  log(message, force = false) {
    if (this.options.verbose || force) {
      console.log(`[Manifest] ${message}`)
    }
  }

  async generateManifest() {
    const { version, encryptedPackage, changelog, output, githubRepo } = this.options

    this.log(`📋 Generating manifest for version ${version}`, true)

    try {
      // 1. 读取加密包信息
      const packageInfo = await this.readEncryptedPackage(encryptedPackage)
      this.log(`✅ Read encrypted package info`)

      // 2. 读取 changelog
      const changelogContent = await this.readChangelog(changelog)
      this.log(`✅ Read changelog content`)

      // 3. 生成下载 URL
      const downloadUrls = this.generateDownloadUrls(githubRepo, version)
      this.log(`✅ Generated download URLs`)

      // 4. 构建 manifest
      const manifest = this.buildManifest(
        version, 
        packageInfo, 
        changelogContent, 
        downloadUrls
      )

      // 5. 保存 manifest
      await this.saveManifest(manifest, output)
      this.log(`✅ Manifest saved to ${output}`, true)

      return manifest

    } catch (error) {
      this.log(`❌ Manifest generation failed: ${error.message}`, true)
      throw error
    }
  }

  async readEncryptedPackage(packagePath) {
    this.log(`📦 Reading encrypted package: ${packagePath}`)

    if (!fs.existsSync(packagePath)) {
      throw new Error(`Encrypted package not found: ${packagePath}`)
    }

    const packageContent = fs.readFileSync(packagePath, 'utf8')
    const encryptedPackage = JSON.parse(packageContent)

    // 验证包结构
    const requiredFields = ['metadata', 'payload', 'signature']
    const missingFields = requiredFields.filter(field => !encryptedPackage[field])

    if (missingFields.length > 0) {
      throw new Error(`Invalid package structure, missing: ${missingFields.join(', ')}`)
    }

    // 获取文件统计信息
    const stats = fs.statSync(packagePath)
    const packageHash = crypto.createHash('sha256')
      .update(packageContent)
      .digest('hex')

    return {
      metadata: encryptedPackage.metadata,
      fileSize: stats.size,
      fileHash: packageHash,
      fileName: path.basename(packagePath)
    }
  }

  async readChangelog(changelogPath) {
    this.log(`📖 Reading changelog: ${changelogPath}`)

    if (!fs.existsSync(changelogPath)) {
      this.log(`⚠️ Changelog not found, using default`)
      return {
        summary: 'Automated release',
        features: [],
        fixes: [],
        changes: []
      }
    }

    const changelogContent = fs.readFileSync(changelogPath, 'utf8')
    
    // 解析 changelog（简单的 Markdown 解析）
    const parsed = this.parseChangelog(changelogContent)
    
    return parsed
  }

  parseChangelog(content) {
    const lines = content.split('\n')
    const result = {
      summary: '',
      features: [],
      fixes: [],
      changes: [],
      breaking: []
    }

    let currentSection = null
    let inSummary = false

    for (const line of lines) {
      const trimmed = line.trim()
      
      // 标题检测
      if (trimmed.startsWith('# ')) {
        result.summary = trimmed.replace(/^# /, '').replace(/v[\d.\-\w]*/, '').trim()
        inSummary = true
        continue
      }
      
      // 段落检测
      if (trimmed.startsWith('## ')) {
        inSummary = false
        const sectionTitle = trimmed.toLowerCase()
        
        if (sectionTitle.includes('新功能') || sectionTitle.includes('feature')) {
          currentSection = 'features'
        } else if (sectionTitle.includes('修复') || sectionTitle.includes('fix') || sectionTitle.includes('bug')) {
          currentSection = 'fixes'
        } else if (sectionTitle.includes('breaking') || sectionTitle.includes('不兼容')) {
          currentSection = 'breaking'
        } else if (sectionTitle.includes('变更') || sectionTitle.includes('change')) {
          currentSection = 'changes'
        } else {
          currentSection = 'changes'
        }
        continue
      }
      
      // 列表项检测
      if (trimmed.startsWith('- ✅') || trimmed.startsWith('- [x]')) {
        const item = trimmed.replace(/^- (✅|\[x\])\s*/, '').trim()
        if (currentSection && item) {
          result[currentSection].push(item)
        }
      }
    }

    // 如果没有解析到摘要，使用默认值
    if (!result.summary) {
      result.summary = 'QBittorrent WebUI Update'
    }

    return result
  }

  generateDownloadUrls(githubRepo, version) {
    const baseUrl = `https://github.com/${githubRepo}/releases/download/v${version}`
    
    return {
      encryptedPackage: `${baseUrl}/qb-webui-renderer-v${version}-encrypted.json`,
      manifest: `${baseUrl}/manifest.json`,
      releaseNotes: `https://github.com/${githubRepo}/releases/tag/v${version}`,
      changelog: `https://github.com/${githubRepo}/blob/main/changelogs/v${version}.md`
    }
  }

  buildManifest(version, packageInfo, changelogContent, downloadUrls) {
    this.log(`🔨 Building manifest structure`)

    const manifest = {
      version,
      tag: `v${version}`,
      buildNumber: parseInt(process.env.GITHUB_RUN_NUMBER || '0'),
      minimumAppVersion: '1.0.0',
      
      // 平台兼容性
      platform: {
        darwin: true,
        win32: true,
        linux: true
      },
      
      // 时间戳
      timestamp: new Date().toISOString(),
      prerelease: version.includes('-'),
      
      // 包信息
      package: {
        name: packageInfo.fileName,
        size: packageInfo.fileSize,
        hash: `sha256:${packageInfo.fileHash}`,
        downloadUrl: downloadUrls.encryptedPackage,
        metadata: {
          originalSize: packageInfo.metadata.size,
          encryptedSize: packageInfo.metadata.encryptedSize,
          algorithm: packageInfo.metadata.algorithm,
          keyAlgorithm: packageInfo.metadata.keyAlgorithm
        }
      },
      
      // 安全信息
      security: {
        encrypted: true,
        signed: true,
        algorithm: packageInfo.metadata.algorithm,
        hashAlgorithm: packageInfo.metadata.hashAlgorithm
      },
      
      // 更新说明
      release: {
        name: changelogContent.summary,
        notes: {
          features: changelogContent.features,
          fixes: changelogContent.fixes,
          changes: changelogContent.changes,
          breaking: changelogContent.breaking
        },
        urls: {
          release: downloadUrls.releaseNotes,
          changelog: downloadUrls.changelog
        }
      },
      
      // 兼容性和回滚配置
      compatibility: {
        rollbackSupported: true,
        safeMode: true,
        backupRequired: true,
        maxRollbackVersions: 3
      },
      
      // 更新行为配置
      updateBehavior: {
        autoDownload: true,
        autoApply: false, // 需要用户确认
        restartRequired: false,
        notifyUser: true
      }
    }

    this.log(`📊 Manifest info:`)
    this.log(`   Version: ${manifest.version}`)
    this.log(`   Prerelease: ${manifest.prerelease}`)
    this.log(`   Package Size: ${(manifest.package.size / 1024 / 1024).toFixed(2)} MB`)
    this.log(`   Features: ${manifest.release.notes.features.length}`)
    this.log(`   Fixes: ${manifest.release.notes.fixes.length}`)

    return manifest
  }

  async saveManifest(manifest, outputPath) {
    this.log(`💾 Saving manifest to: ${outputPath}`)

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 保存格式化的 JSON
    const jsonString = JSON.stringify(manifest, null, 2)
    fs.writeFileSync(outputPath, jsonString, 'utf8')

    // 验证保存的文件
    const stats = fs.statSync(outputPath)
    this.log(`✅ Manifest saved (${(stats.size / 1024).toFixed(1)} KB)`)
  }
}

// 执行生成
async function main() {
  try {
    const generator = new ManifestGenerator(program.opts())
    await generator.generateManifest()
    
    console.log('\n🎉 Manifest generation completed successfully!')
    process.exit(0)
    
  } catch (error) {
    console.error('❌ Manifest generation failed:', error.message)
    if (program.opts().verbose) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { ManifestGenerator }
```

**Key Generation Utility:**

```javascript
#!/usr/bin/env node
// File: Torrent-Vibe/Renderer-Update-Center/scripts/generate-app-keys.js

const fs = require('node:fs')
const path = require('node:path')
const { generateKeyPairSync, createHash } = require('node:crypto')

class AppKeyGenerator {
  constructor() {
    this.keysDir = path.join(__dirname, '../keys')
    this.clientKeysDir = path.join(__dirname, '../client-keys')
  }

  async generateAppKeys() {
    console.log('🔑 Generating QBittorrent WebUI Application Keys')
    console.log('   (These keys are unique to the entire application)\n')

    // 确保目录存在
    fs.mkdirSync(this.keysDir, { recursive: true })
    fs.mkdirSync(this.clientKeysDir, { recursive: true })

    // 生成应用级加密/解密密钥对
    console.log('📦 Generating application encryption key pair...')
    const appKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })

    // 生成应用级签名/验证密钥对
    console.log('✍️  Generating application signing key pair...')
    const signingKeys = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })

    // 保存更新中心使用的密钥
    fs.writeFileSync(
      path.join(this.keysDir, 'app-encrypt-public.pem'),
      appKeys.publicKey
    )
    fs.writeFileSync(
      path.join(this.keysDir, 'app-signing-public.pem'),
      signingKeys.publicKey
    )

    // 保存客户端需要的密钥
    fs.writeFileSync(
      path.join(this.clientKeysDir, 'app-decrypt-private.pem'),
      appKeys.privateKey
    )
    fs.writeFileSync(
      path.join(this.clientKeysDir, 'app-verify-public.pem'),
      signingKeys.publicKey
    )

    // 显示签名私钥用于 GitHub Secrets
    console.log('\n🔐 GitHub Secrets Configuration:')
    console.log('='.repeat(50))
    console.log('Secret Name: APP_SIGNING_PRIVATE_KEY')
    console.log('Secret Value:')
    console.log(signingKeys.privateKey)

    // 生成密钥指纹用于验证
    const appFingerprint = this.generateKeyFingerprint(appKeys.publicKey)
    const signingFingerprint = this.generateKeyFingerprint(signingKeys.publicKey)

    console.log('\n🔍 Application Key Fingerprints:')
    console.log(`   Encryption: ${appFingerprint}`)
    console.log(`   Signing: ${signingFingerprint}`)

    // 创建密钥元数据
    const keyMetadata = {
      generated: new Date().toISOString(),
      application: 'QBittorrent WebUI',
      scope: 'global',
      purpose: {
        encryption: 'Encrypt/decrypt update packages for all users',
        signing: 'Sign/verify update packages for integrity'
      },
      fingerprints: {
        encryption: appFingerprint,
        signing: signingFingerprint
      },
      keyPairs: {
        encryption: {
          public: 'app-encrypt-public.pem (update center)',
          private: 'app-decrypt-private.pem (client embedded)'
        },
        signing: {
          public: 'app-verify-public.pem (client embedded)', 
          private: 'GitHub Secret: APP_SIGNING_PRIVATE_KEY'
        }
      },
      security: {
        algorithm: 'RSA-2048',
        uniqueness: 'One key pair for entire application',
        distribution: 'Embedded in application binary'
      }
    }

    fs.writeFileSync(
      path.join(this.keysDir, 'app-key-metadata.json'),
      JSON.stringify(keyMetadata, null, 2)
    )

    // 创建客户端部署说明
    this.generateClientDeploymentInstructions()

    console.log('\n✅ Application keys generated successfully!')
    console.log('📋 Next steps:')
    console.log('   1. Add APP_SIGNING_PRIVATE_KEY to GitHub Secrets')
    console.log('   2. Copy client keys to main repository')
    console.log('   3. All users will use the same embedded keys')
  }

  generateClientDeploymentInstructions() {
    const instructions = `# QBittorrent WebUI - Client Key Deployment

## 概述
这些密钥对整个 QBittorrent WebUI 应用是全局唯一的。
所有用户的客户端都使用相同的密钥来解密更新包。

## 部署步骤

### 1. 复制密钥到主仓库
\`\`\`bash
# 进入主仓库目录
cd /path/to/innei/qb-client-webui

# 创建密钥目录
mkdir -p resources/keys

# 复制应用级密钥
cp ../Renderer-Update-Center/client-keys/app-decrypt-private.pem resources/keys/
cp ../Renderer-Update-Center/client-keys/app-verify-public.pem resources/keys/
\`\`\`

### 2. 验证密钥部署
\`\`\`bash
# 检查密钥文件
ls -la resources/keys/
# 应该包含:
# - app-decrypt-private.pem (用于解密更新包)
# - app-verify-public.pem   (用于验证签名)
\`\`\`

### 3. 构建配置
确保 Electron 构建过程包含 resources/keys/ 目录到最终应用包中。

## 安全说明

✅ **唯一性**: 整个应用使用一对密钥
✅ **分发**: 密钥内置在应用二进制文件中  
✅ **访问控制**: 只有拥有解密私钥的客户端能够解密更新包
✅ **完整性**: 签名验证确保更新包未被篡改

## 密钥轮换

如需更换应用密钥:
1. 重新生成密钥对
2. 更新所有客户端应用
3. 更新 GitHub Secrets
4. 所有新的更新包使用新密钥加密
`

    fs.writeFileSync(
      path.join(this.clientKeysDir, 'DEPLOYMENT.md'),
      instructions
    )
  }

  generateKeyFingerprint(publicKey) {
    return createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase()
  }
}

// 运行密钥生成
if (require.main === module) {
  new AppKeyGenerator().generateAppKeys().catch(error => {
    console.error('❌ Key generation failed:', error.message)
    process.exit(1)
  })
}

module.exports = { AppKeyGenerator }
```

### Hot Update Content Loader

```typescript
export class HotUpdateContentLoader implements WindowContentLoader {
  private updateManager: UpdateManager
  private fallbackService: FallbackService
  private hotUpdatePath: string
  private healthCheckInterval?: NodeJS.Timeout

  constructor(options: HotUpdateOptions) {
    this.hotUpdatePath = join(app.getPath('userData'), 'hot-updates')
    this.updateManager = new UpdateManager(this.hotUpdatePath)
    this.fallbackService = new FallbackService({
      hotUpdatePath: this.hotUpdatePath,
      builtInLoader: options.fallbackLoader  // DefaultWindowContentLoader
    })
  }

  // Fallback priority: Hot Update → Backup → Built-in → Safe Mode
  async getContentSource(): Promise<string> {
    if (this.isDevelopment) {
      return this.fallbackLoader.getDevServerUrl()
    }

    try {
      const hotUpdatePath = await this.getValidatedHotUpdatePath()
      if (hotUpdatePath) return `file://${hotUpdatePath}`
    } catch (error) {
      console.warn('Hot update failed, using fallback:', error)
    }

    return this.fallbackLoader.getProductionIndexPath()
  }
}
```

### Update Manager Implementation

```typescript
export class UpdateManager {
  private signatureService: SignatureService
  private updateService: GitHubUpdateService  
  private decryptionService: PackageDecryptionService

  constructor(updatePath: string, options: UpdateManagerOptions = {}) {
    this.updatePath = updatePath
    this.signatureService = new SignatureService()
    this.updateService = new GitHubUpdateService({
      owner: 'Torrent-Vibe',
      repo: 'Renderer-Update-Center'
    })
    this.decryptionService = new PackageDecryptionService()
  }

  // Full update pipeline: Check → Download → Decrypt → Verify → Extract → Activate
  async checkForUpdates(): Promise<boolean> {
    const currentVersion = this.getCurrentVersion()
    const latestRelease = await this.updateService.getLatestRelease()
    
    if (this.shouldUpdate(currentVersion, latestRelease.version)) {
      if (this.options.autoDownload) {
        await this.downloadAndPrepareUpdate(latestRelease)
      }
      return true
    }
    return false
  }

  async downloadAndPrepareUpdate(releaseInfo: GitHubReleaseInfo): Promise<boolean> {
    const encryptedPackagePath = join(this.updatePath, 'cache', `${releaseInfo.version}-encrypted.json`)
    const decryptedPackagePath = join(this.updatePath, 'cache', `${releaseInfo.version}.zip`)
    const extractPath = join(this.updatePath, 'pending', releaseInfo.version)

    // Download encrypted package
    await this.updateService.downloadAsset(releaseInfo.encryptedAsset, encryptedPackagePath)
    
    // Decrypt using application-wide keys
    await this.decryptionService.decryptUpdatePackage(encryptedPackagePath, decryptedPackagePath)
    
    // Extract and validate
    await this.extractAndValidatePackage(decryptedPackagePath, extractPath)
    
    return true
  }
}
```

### Multi-Tier Fallback System

```typescript
export class FallbackService {
  private strategies: FallbackStrategy[] = [
    {
      priority: 1,
      name: 'current-hot-update',
      condition: (ctx) => ctx.userDataAvailable && ctx.attemptCount === 0,
      execute: (ctx) => this.loadHotUpdate(ctx),
      maxRetries: 2
    },
    {
      priority: 2, 
      name: 'last-known-good-backup',
      condition: (ctx) => ctx.userDataAvailable && ctx.lastSuccessfulVersion,
      execute: (ctx) => this.loadBackupVersion(ctx),
      maxRetries: 1
    },
    {
      priority: 3,
      name: 'built-in-app-asar',
      condition: (ctx) => ctx.appAsarIntact,
      execute: (ctx) => this.loadBuiltInVersion(ctx),
      maxRetries: 1
    },
    {
      priority: 4,
      name: 'emergency-safe-mode',
      condition: () => true,
      execute: (ctx) => this.loadSafeModeInterface(ctx),
      maxRetries: 0
    }
  ]

  async handleFallback(errorType: FallbackErrorType): Promise<WindowContentLoader> {
    const context: FallbackContext = {
      errorType,
      attemptCount: 0,
      userDataAvailable: this.checkUserDataAccess(),
      appAsarIntact: this.checkAppAsarIntegrity()
    }

    for (const strategy of this.strategies) {
      if (strategy.condition(context)) {
        try {
          return await strategy.execute(context)
        } catch (error) {
          console.warn(`Fallback strategy ${strategy.name} failed:`, error)
          context.attemptCount++
        }
      }
    }
    
    throw new Error('All fallback strategies exhausted')
  }
}
```

## Implementation Tasks

### Phase 1: Core Infrastructure & Key Management (Days 1-3)

1. **Generate Application-Wide Key Pairs**
   - Create RSA-2048 key generation script for update center
   - Generate encryption key pair (public for update center, private for clients)
   - Generate signing key pair (private for update center, public for clients)  
   - **Files**: `Torrent-Vibe/Renderer-Update-Center/scripts/generate-app-keys.js`

2. **Implement Package Decryption Service**
   - Create client-side decryption service with embedded keys
   - Support AES-256-GCM decryption with RSA-encrypted keys
   - Add signature verification with application public key
   - **File**: `layer/main/src/services/package-decryption-service.ts`

3. **Create Hot Update Content Loader** 
   - Extend WindowContentLoader interface for hot updates
   - Implement fallback chain: hot update → backup → built-in → safe mode
   - Add health checking and update validation
   - **File**: `layer/main/src/manager/hot-content-loader.ts`

4. **Integrate Bootstrap System**
   - Modify ElectronBootstrap to use HotUpdateContentLoader optionally
   - Add feature flag for enabling/disabling hot updates
   - Maintain 100% backward compatibility with existing code
   - **File**: Update `layer/main/src/manager/bootstrap.ts`

### Phase 2: Update Management & GitHub Integration (Days 4-6)

5. **Implement Update Manager**
   - Create core update orchestration with state management
   - Add version comparison and update decision logic
   - Implement download, decrypt, extract, and activation pipeline
   - **File**: `layer/main/src/manager/update-manager.ts`

6. **Create GitHub Update Service**
   - Integrate GitHub Releases API with @octokit/rest
   - Support multiple mirror sources for download resilience
   - Add progress tracking and error handling
   - **File**: `layer/main/src/services/github-update-service.ts`

7. **Build Fallback Service System**
   - Implement multi-tier fallback strategy pattern
   - Add automatic fallback triggering on various error types
   - Create safe mode interface for emergency situations
   - **File**: `layer/main/src/services/fallback-service.ts`

8. **Add Hot Update Type Definitions**
   - Define comprehensive TypeScript interfaces
   - Add Zod schemas for runtime validation
   - Create error type definitions and context interfaces
   - **File**: `layer/main/src/types/hot-update.types.ts`

### Phase 3: Update Center Repository Setup (Days 7-9)

9. **Setup Update Center Repository Structure**
   - Initialize `Torrent-Vibe/Renderer-Update-Center` repository
   - Create directory structure for changelogs, keys, scripts
   - Add key generation and management scripts
   - **Repository**: Complete update center setup

10. **Implement Manual Changelog Workflow**
    - Create changelog template and validation system
    - Build release preparation script with interactive editing
    - Add automated branch creation and PR workflow
    - **Files**: 
      - `scripts/prepare-release.js`
      - `changelogs/template.md`

11. **Create Package Encryption System** 
    - Build update package creation scripts
    - Implement RSA+AES hybrid encryption
    - Add digital signature generation
    - **Files**:
      - `scripts/create-update-package.js`
      - `scripts/encrypt-package.js`
      - `scripts/encryption-service.js`

12. **Build Update Center CI/CD Pipeline**
    - Create GitHub Actions workflow for automated builds
    - Add encrypted package creation and release automation
    - Implement changelog integration and release notes
    - **File**: `.github/workflows/release.yml`

### Phase 4: Cross-Repository Coordination (Days 10-12)

13. **Add Main Repository Build Trigger**
    - Create workflow to trigger update center builds
    - Add repository dispatch event integration
    - Implement build artifact sharing between repositories
    - **File**: `innei/qb-client-webui/.github/workflows/trigger-update.yml`

14. **Implement Update Center Build Automation**
    - Add artifact download from main repository
    - Create automated package creation and encryption
    - Implement GitHub Release creation with changelog integration
    - **Update**: Update center workflow enhancements

15. **Setup Secrets and Configuration**
    - Configure GitHub Secrets for signing private key
    - Add source repository access token
    - Set up cross-repository permissions
    - **Configuration**: Repository secrets setup

16. **Deploy Application Keys to Main Repository**
    - Copy generated client keys to main repository
    - Update build configuration to include keys in resources
    - Verify key deployment in Electron application bundle
    - **Files**: `resources/keys/app-decrypt-private.pem`, `resources/keys/app-verify-public.pem`

### Phase 5: User Data Directory & Storage (Days 13-14)

17. **Implement User Data Directory Structure**
    - Create hot-updates directory structure in userData
    - Add directory initialization and permission handling
    - Implement cleanup and maintenance routines
    - **Integration**: Update manager directory creation

18. **Add Update Storage Management**
    - Implement update package caching and cleanup
    - Add backup version management
    - Create storage quota and cleanup policies
    - **Enhancement**: Update manager storage features

19. **Build Health Monitoring System**
    - Add update system health checking
    - Implement performance monitoring and metrics
    - Create diagnostic information collection
    - **Files**: Health monitoring integration

### Phase 6: Testing & Validation (Days 15-16)

20. **Create Validation Test Suite**
    - Build encryption/decryption test cases
    - Add update pipeline integration tests
    - Create fallback system validation tests
    - **Files**: Test suite implementation

21. **Implement Security Validation**
    - Add package signature verification tests
    - Create key management security tests
    - Validate encryption strength and implementation
    - **Integration**: Security test suite

22. **End-to-End Integration Testing**
    - Test complete update pipeline from main repo to client
    - Validate cross-repository build coordination
    - Test fallback scenarios and error handling
    - **Process**: Complete system testing

### Phase 7: Documentation & Polish (Days 17-18)

23. **Create System Documentation**
    - Document key management and rotation procedures
    - Create operational guides for release process
    - Add troubleshooting and diagnostics documentation
    - **Files**: Documentation creation

24. **Final Integration & Error Handling**
    - Integrate hot update system into main application flow
    - Add comprehensive error handling and user feedback
    - Implement graceful degradation for all failure modes
    - **Integration**: Final system integration

## Validation Gates

### Build Quality Checks
```bash
# TypeScript validation
cd layer/renderer && pnpm typecheck
cd layer/main && tsc --noEmit

# ESLint validation  
pnpm lint

# Build validation
pnpm build
pnpm electron:build
```

### Security Validation
```bash
# Key generation and validation
cd Torrent-Vibe/Renderer-Update-Center
node scripts/generate-app-keys.js

# Package encryption/decryption testing
node scripts/test-encryption-cycle.js

# Signature verification testing
node scripts/test-signature-validation.js
```

### Integration Testing
```bash
# Cross-repository coordination testing
# 1. Trigger main repository build
# 2. Verify update center receives dispatch
# 3. Confirm artifact download works
# 4. Validate encrypted package creation
# 5. Test GitHub Release creation

# Client update testing
# 1. Deploy test update package
# 2. Verify client update detection
# 3. Test download and decryption
# 4. Confirm hot swap functionality
# 5. Validate fallback mechanisms
```

### End-to-End Validation
```bash
# Complete update cycle testing
# 1. Make change in main repository
# 2. Create changelog in update center
# 3. Trigger automated build pipeline
# 4. Test client update process
# 5. Verify fallback system works
# 6. Confirm security measures effective
```

## Gotchas & Critical Considerations

### Security Architecture Gotchas

1. **Application-Wide Key Uniqueness**: All QBittorrent WebUI installations use identical decryption keys
   - **Risk**: Single compromised client exposes decryption capability
   - **Mitigation**: Keys are embedded in signed application binary, rotation requires full app update
   - **Accept**: Trade-off for simplified distribution without key registration server

2. **Private Key Exposure in Client**: Decryption private key must be embedded in application
   - **Risk**: Determined attacker can extract keys from application binary
   - **Mitigation**: Obfuscation during build, signature verification prevents unauthorized packages
   - **Accept**: Standard practice for client-side decryption systems

3. **GitHub Secrets Management**: Critical signing private key stored in GitHub Secrets
   - **Risk**: Repository compromise could expose signing capability
   - **Critical**: Use GitHub Secret scanning, enable 2FA, limit repository access
   - **Monitor**: Audit secret access logs regularly

### Cross-Repository Coordination Gotchas

1. **Repository Dispatch Rate Limits**: GitHub API limits on repository dispatch events
   - **Issue**: Frequent builds could hit rate limits
   - **Solution**: Wrap dispatch calls in retry steps with exponential backoff (e.g., max 5 attempts)
   - **Monitor**: Track API usage in workflow logs

2. **Artifact Download Timing**: Race conditions between artifact upload and download
   - **Issue**: Update center might attempt download before artifact is ready
   - **Solution**: Retry artifact downloads with exponential backoff and verify availability before proceeding
   - **Validation**: Verify artifact existence before download attempt

3. **Build Artifact Size Limits**: GitHub Artifacts have size and retention limits
   - **Issue**: Large renderer builds might exceed limits
   - **Solution**: Compress artifacts and set appropriate retention policies
   - **Monitor**: Track artifact sizes and usage

### Update System Gotchas

1. **User Data Directory Permissions**: Hot update extraction requires write permissions
   - **Issue**: Corporate environments or limited user accounts might deny access
   - **Solution**: Graceful fallback to built-in version with clear error messaging
   - **Handle**: Detect permission issues and show appropriate user guidance

2. **Concurrent Update Detection**: Multiple application instances updating simultaneously
   - **Issue**: File locking and corruption during update extraction
   - **Solution**: Use a lock file in the user data directory; if acquisition fails, abort extraction with a clear message
   - **Test**: Verify behavior with multiple application instances

3. **Partial Download Recovery**: Network interruptions during package download
   - **Issue**: Corrupted partial downloads breaking update process
   - **Solution**: Resume downloads using HTTP Range requests and validate with SHA-256 checksum
   - **Fallback**: Clear corrupted downloads and retry from beginning

### Performance Considerations

1. **Startup Performance Impact**: Hot update validation adds startup latency
   - **Measure**: Current update validation should complete within 100ms
   - **Optimize**: Cache validation results and use asynchronous health checks
   - **Monitor**: Track startup performance metrics

2. **Background Update Checks**: Periodic update checking consuming resources
   - **Configure**: Default to 6-hour intervals with user configuration option
   - **Optimize**: Use lightweight version checks rather than full package validation
   - **Respect**: System power and network state (don't check on battery/metered)

3. **Storage Usage**: Update packages and backups consuming disk space
   - **Manage**: Implement storage quota with configurable limits
   - **Cleanup**: Automatic old version cleanup with user-configurable retention
   - **Monitor**: Provide storage usage information in application settings

### Version Management Gotchas

1. **Semantic Version Comparison**: Complex version comparison with pre-release tags
   - **Library**: Use semver library for reliable version comparison
   - **Handle**: Pre-release versions (-alpha, -beta, -rc) appropriately
   - **Test**: Comprehensive version comparison test suite

2. **Rollback Capability**: Users wanting to revert to previous versions
   - **Implement**: Maintain last-known-good backup automatically
   - **UI**: Provide rollback option in safe mode interface
   - **Validate**: Ensure rollback versions remain functional

3. **Update Center Version Coordination**: Keeping main repo and update center versions synchronized
   - **Process**: Manual changelog creation ensures deliberate version coordination
   - **Validate**: Version validation in update center build process
   - **Document**: Clear procedures for version management across repositories

## Success Criteria

- ✅ **Security**: All update packages encrypted with application-unique keys, signature verification prevents tampering
- ✅ **Reliability**: Multi-tier fallback system ensures application always remains functional
- ✅ **Performance**: Hot updates complete within 30 seconds, startup impact < 100ms
- ✅ **Usability**: Updates happen transparently with optional user notification
- ✅ **Maintainability**: Clear separation between main development and update distribution
- ✅ **Scalability**: GitHub-based distribution handles global user base without custom infrastructure
- ✅ **Compatibility**: 100% backward compatibility maintained, feature can be disabled
- ✅ **Operational**: Manual changelog process ensures quality control over releases
- ✅ **Automation**: Fully automated build and distribution pipeline after manual approval
- ✅ **Recovery**: Safe mode interface provides recovery path for all failure scenarios

## External References & Documentation

### Core Technologies
- **Node.js Crypto Module**: https://nodejs.org/api/crypto.html - RSA and AES encryption implementation
- **Electron Security**: https://www.electronjs.org/docs/tutorial/security - Context isolation and secure loading
- **GitHub Actions**: https://docs.github.com/en/actions - CI/CD workflow automation
- **GitHub Releases API**: https://docs.github.com/en/rest/releases - Release management integration

### Security Research
- **OWASP Cryptographic Storage**: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- **Electron Code Signing**: https://www.electronjs.org/docs/tutorial/code-signing
- **Package Integrity Verification**: Best practices for signature validation

### Implementation Examples  
- **Hybrid Encryption Examples**: RSA+AES implementation patterns in Node.js
- **GitHub Repository Dispatch**: Cross-repository coordination examples
- **Electron Auto-Update Alternatives**: Manual update system implementations

## PRP Quality Score: 9/10

**Confidence Level**: Very High - This PRP provides comprehensive architectural design, detailed security considerations, complete implementation guidance, and addresses all critical technical challenges. The phased approach with clear validation gates ensures systematic implementation.

**Deductions**: Minor complexity in cross-repository coordination that may require iterative refinement during initial setup phase.

**Implementation Readiness**: All necessary context, external references, existing code patterns, and technical specifications are provided for successful one-pass implementation.