# Type-Safe Electron Bridge Architecture PRP

## Overview

Implement a comprehensive type-safe, centralized bridge architecture for Electron main-to-renderer communication that addresses current fragmentation issues. The system will replace scattered `webContents.send()` calls with a unified, type-safe event broadcasting system while maintaining full compatibility with the existing `electron-ipc-decorator` pattern for request/response communication.

The implementation solves three critical issues: lack of centralized management, absence of type safety for events, and fragmented communication patterns across the codebase.

## Research Context & Findings

### Current Architecture Analysis

**Existing IPC Patterns Identified:**

1. **Modern IPC Services**: Using `electron-ipc-decorator` with decorators
   - Pattern: `/layer/main/src/ipc/services.ts` - `createServices()` with service classes
   - Pattern: `/layer/main/src/ipc/app.service.ts` - `@IpcMethod()` decorated methods
   - Pattern: `/layer/renderer/src/lib/ipc-client.ts` - `createIpcProxy<IpcServicesType>()`
   - **Status**: Well-structured, type-safe, follows decorator pattern

2. **Legacy Direct IPC**: Manual `ipcMain.handle()` calls
   - Location: `/layer/main/src/bootstrap.ts:484-507`
   - Methods: `get-theme`, `set-theme`, `get-system-info`
   - **Status**: Should be migrated to service pattern

3. **Direct WebContents Communication**: Problematic pattern
   - Location: `/layer/main/src/services/update-service.ts:257`
   - Pattern: `win.webContents.send('update:ready', updateInfo)`
   - **Issues**: No type safety, manual window management, no centralization

**Existing Type Organization:**
- Pattern: `/layer/main/src/@types/` - Shared type definitions
- Example: `/layer/main/src/@types/constants.ts` - Language and namespace types
- Convention: Types shared between main and renderer processes

**Hook and Store Patterns:**
- **Custom Hooks**: Return object interface with stable references
  - Pattern: `/layer/renderer/src/modules/multi-server/hooks/useServerConfigForm.ts`
  - Convention: `useCallback` for stability, clear return interface
  
- **Zustand Stores**: Centralized state with separate setter objects
  - Pattern: `/layer/renderer/src/modules/torrent/stores/torrent-table-store.ts`
  - Convention: `createWithEqualityFn`, `subscribeWithSelector`, separate setters

- **Context Menu Integration**: Type-safe menu system available
  - Pattern: `/layer/renderer/src/modules/torrent/hooks/use-torrent-table-column-menu.ts:25`
  - Usage: `useShowContextMenu()` with `MenuItemText` objects

### Key Dependencies Available

**Core Libraries:**
- `electron-ipc-decorator@0.2.0` - Current IPC service framework (custom/private library)
- `zustand@5.0.7` - Primary state management with `subscribeWithSelector`
- `jotai@2.13.1` - Secondary reactive atoms with custom `createAtomHooks`
- `motion@12.23.12` - Framer Motion for animations (using `m.` not `motion.`)
- `react@19.1.1` - Latest React with modern patterns

**Utility Libraries:**
- `usehooks-ts@3.1.1` - Modern React hooks library
- `es-toolkit@1.39.9` - Modern utility library (replaces lodash)
- `immer@10.1.1` - Immutable updates in stores
- `pathe@2.0.3` - Cross-platform path utilities

### External Research - Modern Electron IPC Patterns (2024)

**Type-Safe Communication Best Practices:**
- **Shared Type Definitions**: Central interface definitions accessible to both processes
- **Schema-Based Validation**: Runtime validation with TypeScript compile-time checking
- **Event-Driven Architecture**: Separation of events (push) vs RPC calls (request/response)
- **Security-First Design**: Limited API exposure through contextBridge

**Reference Documentation:**
- [LogRocket Electron IPC TypeScript Guide 2024](https://blog.logrocket.com/electron-ipc-response-request-architecture-with-typescript/)
- [Electron Official IPC Guide](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [TypeScript Safe Electron Communication Patterns](https://kishannirghin.medium.com/adding-typesafety-to-electron-ipc-with-typescript-d12ba589ea6a)

## Implementation Blueprint

### 1. Type System Foundation

```typescript
// layer/main/src/@types/bridge-events.ts
export interface BridgeEventMap {
  // Update events
  'update:ready': { version: string; prerelease: boolean }
  'update:progress': { percent: number; transferred: number; total: number }
  'update:error': { message: string; code?: string }
  'update:downloaded': { version: string }
  
  // Theme events  
  'theme:changed': { theme: 'light' | 'dark' | 'system' }
  
  // System events
  'system:low-memory': { available: number; total: number }
  'system:network-changed': { online: boolean }
  
  // Application events
  'app:focus': { focused: boolean }
  'app:minimized': { minimized: boolean }
}

export type BridgeEventName = keyof BridgeEventMap
export type BridgeEventData<T extends BridgeEventName> = BridgeEventMap[T]
```

### 2. Main Process Bridge Service

**Core Architecture:**
```typescript
// layer/main/src/services/bridge-service.ts
export class BridgeService {
  private static instance: BridgeService
  private windowManager: Set<BrowserWindow> = new Set()
  
  static get shared(): BridgeService
  registerWindow(window: BrowserWindow): void
  broadcast<T extends BridgeEventName>(eventName: T, data: BridgeEventData<T>): void
  sendToWindow<T extends BridgeEventName>(window: BrowserWindow, eventName: T, data: BridgeEventData<T>): void
  sendToFocused<T extends BridgeEventName>(eventName: T, data: BridgeEventData<T>): void
}
```

**Integration Pattern:**
- Follow existing singleton patterns: `UpdateService.shared`, `QBittorrentClient.shared`
- Window management with automatic cleanup on `'closed'` event
- Type-safe event broadcasting with compile-time validation

### 3. IPC Service Integration

**New Bridge IPC Service:**
```typescript
// layer/main/src/ipc/bridge.service.ts
export class BridgeIPCService extends IpcService {
  static override readonly groupName = 'bridge'
  
  @IpcMethod()
  subscribeToEvents(context: IpcContext, events: BridgeEventName[]): void
}
```

**Service Registration:**
```typescript
// layer/main/src/ipc/services.ts - Add to existing services array
export const services = createServices([
  WindowService,
  AppService,
  SecurityIPCService,
  BridgeIPCService, // New bridge service
])
```

### 4. Renderer Bridge Client

**Client Architecture:**
```typescript
// layer/renderer/src/lib/bridge-client.ts
export class BridgeClient {
  private static instance: BridgeClient
  private eventListeners = new Map<BridgeEventName, Set<EventListener<any>>>()
  
  static get shared(): BridgeClient
  on<T extends BridgeEventName>(eventName: T, listener: EventListener<T>): UnsubscribeFn
  once<T extends BridgeEventName>(eventName: T, listener: EventListener<T>): UnsubscribeFn
  off<T extends BridgeEventName>(eventName: T): void
}

export const bridgeClient = BridgeClient.shared
```

### 5. React Hook Integration

**Following Existing Hook Patterns:**
```typescript
// layer/renderer/src/hooks/use-bridge-event.ts
export function useBridgeEvent<T extends BridgeEventName>(
  eventName: T,
  listener: EventListener<T>,
  dependencies: React.DependencyList = []
): void

export function useBridgeEventOnce<T extends BridgeEventName>(
  eventName: T,
  listener: EventListener<T>,
  dependencies: React.DependencyList = []
): void
```

**Pattern Consistency:**
- Follow `/layer/renderer/src/modules/multi-server/hooks/useServerConfigForm.ts` patterns
- Use `useCallback` for listener stability
- Automatic cleanup with `useEffect` return function
- Dependency array handling for listener updates

### 6. Enhanced Preload Script

**Type-Safe Bridge API:**
```typescript
// layer/main/preload/index.ts (convert from .js to .ts)
const bridgeAPI = {
  on: (channel: string, listener: (...args: any[]) => void) => {
    if (channel === 'bridge:event') {
      ipcRenderer.on(channel, listener)
    }
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('bridge:event')
  }
}

contextBridge.exposeInMainWorld('bridgeAPI', bridgeAPI)
```

## Implementation Tasks (Sequential Order)

### Phase 1: Foundation (Immediate)
1. **Create Type Definitions**
   - Add `/layer/main/src/@types/bridge-events.ts`
   - Define `BridgeEventMap` interface with initial events
   - Export utility types `BridgeEventName` and `BridgeEventData<T>`

2. **Implement Core Bridge Service**
   - Create `/layer/main/src/services/bridge-service.ts`
   - Implement singleton pattern following existing `UpdateService.shared`
   - Add window management with automatic cleanup
   - Implement type-safe broadcasting methods

3. **Create Bridge IPC Service**
   - Add `/layer/main/src/ipc/bridge.service.ts`
   - Follow existing service patterns from `AppService`
   - Register in `/layer/main/src/ipc/services.ts`

### Phase 2: Client Implementation
4. **Implement Renderer Bridge Client**
   - Create `/layer/renderer/src/lib/bridge-client.ts`
   - Follow singleton patterns from existing codebase
   - Implement event listener management with type safety

5. **Create React Hooks**
   - Add `/layer/renderer/src/hooks/use-bridge-event.ts`
   - Follow patterns from existing hooks like `useServerConfigForm`
   - Implement automatic cleanup and dependency handling

6. **Enhance Preload Script**
   - Convert `/layer/main/preload/index.js` to TypeScript
   - Add `bridgeAPI` with security-conscious channel filtering
   - Update global type declarations

### Phase 3: Integration & Migration
7. **Bootstrap Integration**
   - Update `/layer/main/src/bootstrap.ts`
   - Register main window with `BridgeService.shared.registerWindow()`
   - Remove legacy `ipcMain.handle()` calls

8. **Migrate Update Service**
   - Update `/layer/main/src/services/update-service.ts:257`
   - Replace `win.webContents.send('update:ready', updateInfo)` with type-safe broadcasting
   - Add error event broadcasting

9. **Create Example Component**
   - Add `/layer/renderer/src/components/UpdateNotification.tsx`
   - Demonstrate `useBridgeEvent` usage patterns
   - Show type-safe event subscription

### Phase 4: Validation & Documentation
10. **Add Event Definitions**
    - Expand `BridgeEventMap` with additional events
    - Document event patterns and usage
    - Add JSDoc comments for type definitions

## Error Handling Strategy

**Main Process Error Handling:**
- Service-level error logging with `electron-log`
- Graceful fallback for destroyed windows
- Automatic cleanup of invalid window references

**Renderer Process Error Handling:**
- React error boundaries for hook failures
- Graceful degradation when bridge API unavailable
- Development vs production error messaging

**Type Safety Guarantees:**
- Compile-time validation for event names and payloads
- Runtime validation for critical events (optional)
- Clear error messages for type mismatches

## Validation Gates

```bash
# TypeScript compilation
cd layer/renderer && tsc --noEmit
cd layer/main && tsc --noEmit

# Linting and formatting
pnpm lint
pnpm format

# Type checking across all layers
pnpm typecheck

# Electron build verification
pnpm electron:build

# Development server functionality
pnpm electron:dev
```

## Migration Examples

**Before (Current Problematic Pattern):**
```typescript
// ❌ update-service.ts:257
const win: BrowserWindow | null = BrowserWindow.getAllWindows()[0] ?? null
if (win && !win.isDestroyed()) {
  win.webContents.send('update:ready', updateInfo)
}
```

**After (New Type-Safe Pattern):**
```typescript
// ✅ New implementation
BridgeService.shared.broadcast('update:ready', {
  version: latest.version,
  prerelease: latest.prerelease ?? false,
})
```

**Renderer Usage:**
```typescript
// ✅ Type-safe React component
export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<{
    version: string
    prerelease: boolean
  } | null>(null)

  useBridgeEvent('update:ready', (data) => {
    setUpdateInfo(data) // data is fully typed
  })

  // Component implementation...
}
```

## Architecture Benefits

**Type Safety:**
- Compile-time validation for all events and payloads
- IntelliSense support with auto-completion
- Prevents typos in event names and data structures

**Centralized Management:**
- Single point of control for all window communication
- Automatic window cleanup and management
- Consistent broadcasting patterns

**Developer Experience:**
- Clean React hooks with automatic cleanup
- Clear separation of concerns (events vs RPC)
- Modern TypeScript patterns throughout

**Performance & Security:**
- Optimized window management with cleanup
- Security-conscious preload API exposure
- Efficient event listener management

## Quality Assurance Checklist

- [ ] All event types compile without errors
- [ ] Hook patterns match existing codebase conventions
- [ ] Service registration follows existing patterns
- [ ] Window management includes proper cleanup
- [ ] Error handling covers all failure scenarios
- [ ] Migration preserves all existing functionality
- [ ] Type safety verified with TypeScript strict mode
- [ ] Integration tests pass for all communication patterns
- [ ] Development and production builds succeed
- [ ] Documentation covers all public APIs

## Confidence Score: 9/10

**Reasoning for High Confidence:**
- **Clear Architecture**: Well-defined patterns from existing codebase analysis
- **Type Safety**: Comprehensive TypeScript implementation with compile-time validation
- **Proven Patterns**: Uses existing successful patterns (Zustand, hooks, services)
- **Incremental Migration**: Maintains compatibility while providing clear upgrade path
- **Comprehensive Context**: Detailed understanding of current implementation and constraints

**Risk Mitigation:**
- Phase-based implementation reduces integration complexity
- Maintains backward compatibility during migration
- Clear validation gates ensure quality at each step
- Detailed examples provide implementation guidance