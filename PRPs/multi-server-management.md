# Multi-Server qBittorrent Management System PRP

## Overview

Implement a comprehensive multi-server management system that allows users to configure, connect to, and seamlessly switch between multiple qBittorrent server instances. This system extends the current single-server architecture to support unlimited server connections with health monitoring, server-specific state management, and an intuitive UI for server switching.

The implementation maintains 100% backward compatibility while adding progressive enhancement features for advanced users managing multiple qBittorrent instances.

## Research Context & Findings

### Existing Architecture Analysis

**Current State Management Patterns:**

- **Zustand Stores**: Primary state management using `createWithEqualityFn` with `immer` and `subscribeWithSelector` middleware
  - Pattern: `/layer/renderer/src/modules/torrent/stores/torrent-data-store.ts`
  - Export separate setter objects: `torrentDataStoreSetters`
  - Complex derived state with performance optimization

- **Jotai Atoms**: Secondary reactive state using custom `createAtomHooks` utility
  - Pattern: `/layer/renderer/src/modules/connection/atoms/connection.ts`  
  - Connection status, auth status, server info atoms
  - Custom hooks for read/write operations

- **Storage Management**: Centralized localStorage with namespacing
  - Pattern: `/layer/renderer/src/lib/storage-keys.ts`
  - Utility functions with error handling: `storage.getJSON()`, `storage.setJSON()`
  - Namespaced keys: `createStorageKey(namespace, key)`

**Existing Client Architecture:**

- **Singleton Pattern**: `QBittorrentClient.shared` with static configuration methods
- **Client Factory**: `QBittorrentClient.create(config)` for temporary instances
- **Configuration Loading**: `/layer/renderer/src/shared/config.ts` with `getInitialQBittorrentConfig()`

**Modal System:**

- **Settings Modal**: Tabbed interface using sidebar navigation
  - Pattern: `/layer/renderer/src/modules/modals/SettingsModal/SettingsModal.tsx`
  - Configuration: `/layer/renderer/src/modules/modals/SettingsModal/configs.tsx`
  - Dynamic tab registration with conditions

**Query Management:**

- **React Query Integration**: Type-safe query keys and hooks
  - Pattern: `/layer/renderer/src/lib/query/query-keys.ts` - Centralized key factory
  - Pattern: `/layer/renderer/src/lib/query/query-hooks.ts` - Object-based mutation hooks
  - Automatic cache invalidation scenarios in query manager

### Key Dependencies Available

- **Zustand 5.0.7**: Advanced state management with middleware
- **Jotai 2.13.1**: Reactive atoms for simple state
- **@tanstack/react-query 5.85.0**: Server state management and caching
- **React Router 7.8.0**: File-based routing system
- **Zod 4.0.17**: Runtime type validation and schema definition
- **Immer 10.1.1**: Immutable state updates

### External Research Insights

#### Zustand Multi-Store Patterns
- **Documentation**: https://docs.pmnd.rs/zustand/guides/typescript
- **Multi-Store Management**: https://docs.pmnd.rs/zustand/guides/practice-with-no-store-actions
- **Middleware Patterns**: subscribeWithSelector for granular subscriptions
- **Performance**: Use selectors and shallow comparison for object subscriptions

#### React Query Multi-Instance Management
- **Documentation**: https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr
- **Query Key Scoping**: https://tkdodo.eu/blog/effective-react-query-keys
- **Server Context**: Scope queries by server ID to prevent cross-contamination
- **Optimistic Updates**: Server switching with immediate UI feedback

#### Connection Health Monitoring
- **Best Practices**: Exponential backoff, circuit breaker pattern
- **Health Check Strategies**: Lightweight API calls, configurable intervals
- **Error Handling**: Distinguish between network and authentication failures

## Implementation Blueprint

### Component Architecture

```
/layer/renderer/src/modules/multi-server/
├── types/
│   └── multi-server.ts (TypeScript definitions)
├── stores/
│   ├── multi-server-store.ts (Zustand store for server management)
│   └── server-health-monitor.ts (Health checking service)
├── components/
│   ├── ServerSwitcher.tsx (Header dropdown component)
│   ├── ServerManagementModal.tsx (Full server management UI)
│   ├── ServerConnectionForm.tsx (Add/edit server form)
│   ├── ServerListItem.tsx (Individual server display)
│   └── ServerHealthIndicator.tsx (Status badge component)
├── hooks/
│   ├── useMultiServerState.ts (Main state access hook)
│   ├── useServerHealth.ts (Health monitoring hook)
│   ├── useServerSwitching.ts (Server switching logic)
│   └── useServerValidation.ts (Connection testing)
└── utils/
    ├── server-config.ts (Configuration management)
    ├── server-migration.ts (Single to multi-server migration)
    └── connection-pool.ts (Client management)
```

### Enhanced API Layer

```
/layer/renderer/src/shared/api/
├── enhanced-qbittorrent-client.ts (Backward-compatible client wrapper)
└── multi-server-client-manager.ts (Client pool management)

/layer/renderer/src/lib/query/
├── multi-server-query-keys.ts (Server-scoped query keys)  
├── multi-server-query-hooks.ts (Enhanced hooks with server context)
└── query-manager-multi-server.ts (Extended query scenarios)
```

### Data Model Design

```typescript
// Core multi-server types
interface ServerConnection {
  id: string                    // Unique identifier
  name: string                 // Display name
  config: QBittorrentConfig   // Connection configuration
  isDefault: boolean          // Default server flag
  lastConnected?: Date        // Connection history
  status: ConnectionStatus    // Current status
  tags?: string[]            // Organizational tags
  color?: string             // UI color identifier
}

interface MultiServerConfig {
  servers: ServerConnection[]
  activeServerId: string | null
  autoConnectToDefault: boolean
  rememberCredentials: boolean
  connectionTimeout: number
  maxReconnectAttempts: number
  healthCheckInterval: number
}

// Health monitoring
interface ServerHealthResult {
  serverId: string
  status: 'healthy' | 'warning' | 'unhealthy'
  responseTime: number
  lastChecked: Date
  consecutiveFailures: number
  version?: string
  error?: string
}
```

### State Management Strategy

**Multi-Server Store (Zustand):**
```typescript
interface MultiServerState {
  servers: Map<string, ServerConnection>
  activeServerId: string | null
  connectionStates: Map<string, ConnectionStatus>
  switchingToServerId: string | null
  healthResults: Map<string, ServerHealthResult>
}

// Separate setters object following existing pattern
export const multiServerStoreSetters = {
  addServer: (server: ServerConnection) => { /* ... */ },
  removeServer: (serverId: string) => { /* ... */ },
  switchToServer: (serverId: string) => { /* ... */ },
  updateServerHealth: (serverId: string, health: ServerHealthResult) => { /* ... */ },
}
```

**Connection Atoms (Jotai) - Enhanced:**
```typescript
// Extend existing connection atoms to support multi-server context
export const currentServerAtom = atom((get) => {
  const multiServerState = get(multiServerStateAtom)
  const activeId = multiServerState.activeServerId
  return activeId ? multiServerState.servers.get(activeId) : null
})

export const currentConnectionStatusAtom = atom((get) => {
  const state = get(multiServerStateAtom)
  const activeId = state.activeServerId
  return activeId ? state.connectionStates.get(activeId) ?? 'disconnected' : 'disconnected'
})
```

### UI Integration Points

**1. Header Server Switcher:**
```typescript
// Compact dropdown in main header/toolbar
<ServerSwitcher 
  variant="compact" 
  className="ml-4" 
  showAddButton={false} 
/>
```

**2. Enhanced GeneralTab:**
```typescript
// Modified Settings > General tab
<ServerManagementSection 
  servers={servers}
  activeServerId={activeServerId}
  onManageServers={() => setShowServerManager(true)}
/>
```

**3. Onboarding Integration:**
```typescript
// Enhanced onboarding with multi-server hints
<OnboardingComplete 
  showMultiServerHint={true}
  onContinue={handleContinue}
/>
```

### Server Health Monitoring

**Health Check Manager:**
```typescript
export class ServerHealthMonitor {
  private static instance: ServerHealthMonitor
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map()
  
  // Configuration
  private readonly CONFIG = {
    healthCheckInterval: 30000,    // 30 seconds
    timeoutDuration: 10000,       // 10 seconds
    consecutiveFailures: 3,       // Failure threshold
  }

  startMonitoring(servers: ServerConnection[]): void
  performHealthCheck(serverId: string, config: QBittorrentConfig): Promise<void>
  subscribe(listener: (results: Map<string, ServerHealthResult>) => void): () => void
}
```

### Query System Enhancement

**Server-Scoped Query Keys:**
```typescript
export const multiServerQueryKeys = {
  server: (serverId: string) => ['server', serverId] as const,
  torrents: (serverId: string) => ['server', serverId, 'torrents'] as const,
  current: {
    server: () => ['current-server'] as const,
    torrents: () => ['current-server', 'torrents'] as const,
  }
}
```

**Enhanced Query Hooks:**
```typescript
// Backward-compatible hooks that automatically use current server
export function useCurrentServerTorrents() {
  const currentServer = useCurrentServer()
  
  return useQuery({
    queryKey: multiServerQueryKeys.current.torrents(),
    queryFn: () => EnhancedQBittorrentClient.shared.getTorrents(),
    enabled: !!currentServer && useIsCurrentServerConnected(),
  })
}
```

### Storage Migration Strategy

```typescript
// Migrate existing single-server config to multi-server
export function migrateToMultiServer(): MultiServerConfig {
  const existingConfig = loadStoredConnectionConfig()
  
  if (!existingConfig.stored) {
    return createEmptyMultiServerConfig()
  }
  
  // Convert single server to multi-server format
  const firstServer: ServerConnection = {
    id: generateId(),
    name: 'Primary Server',
    config: convertToQBittorrentConfig(existingConfig.stored),
    isDefault: true,
    status: 'disconnected'
  }
  
  return {
    servers: [firstServer],
    activeServerId: firstServer.id,
    autoConnectToDefault: true,
    rememberCredentials: existingConfig.stored.rememberPassword,
    connectionTimeout: 30000,
    maxReconnectAttempts: 3,
    healthCheckInterval: 30000
  }
}
```

## Implementation Tasks

### Phase 1: Core Infrastructure (Days 1-3)

1. **Create Multi-Server Type Definitions**
   - Define `ServerConnection`, `MultiServerConfig`, `ServerHealthResult`
   - Create validation schemas using Zod
   - **File**: `/layer/renderer/src/modules/multi-server/types/multi-server.ts`

2. **Implement Multi-Server Store**
   - Create Zustand store with immer middleware
   - Implement setter functions following existing patterns
   - Add server CRUD operations
   - **File**: `/layer/renderer/src/modules/multi-server/stores/multi-server-store.ts`

3. **Enhanced Storage System**  
   - Extend storage keys for multi-server config
   - Implement migration utilities
   - Add configuration validation
   - **Files**: 
     - Update `/layer/renderer/src/lib/storage-keys.ts`
     - Create `/layer/renderer/src/modules/multi-server/utils/server-config.ts`

4. **Enhanced Client Manager**
   - Create backward-compatible client wrapper
   - Implement client pool management
   - Extend existing `QBittorrentClient` usage
   - **Files**: 
     - `/layer/renderer/src/shared/api/enhanced-qbittorrent-client.ts`
     - `/layer/renderer/src/modules/multi-server/utils/connection-pool.ts`

### Phase 2: Health Monitoring & Query Enhancement (Days 4-5)

5. **Server Health Monitor**
   - Implement health checking service
   - Add configurable intervals and thresholds
   - Create health status propagation
   - **File**: `/layer/renderer/src/modules/multi-server/stores/server-health-monitor.ts`

6. **Enhanced Query System**
   - Create server-scoped query keys
   - Implement enhanced query hooks
   - Add automatic server context switching
   - **Files**:
     - `/layer/renderer/src/lib/query/multi-server-query-keys.ts`
     - `/layer/renderer/src/lib/query/multi-server-query-hooks.ts`

7. **Custom Hooks Implementation**
   - Create state access hooks
   - Implement server switching logic
   - Add connection validation hooks
   - **Files**:
     - `/layer/renderer/src/modules/multi-server/hooks/useMultiServerState.ts`
     - `/layer/renderer/src/modules/multi-server/hooks/useServerSwitching.ts`
     - `/layer/renderer/src/modules/multi-server/hooks/useServerHealth.ts`

### Phase 3: UI Components (Days 6-8)

8. **Server Connection Form**
   - Create add/edit server form with validation
   - Implement real-time connection testing
   - Add advanced configuration options
   - **File**: `/layer/renderer/src/modules/multi-server/components/ServerConnectionForm.tsx`

9. **Server List Components**
   - Create server list item with actions
   - Implement connection status indicators
   - Add health status badges
   - **Files**:
     - `/layer/renderer/src/modules/multi-server/components/ServerListItem.tsx`
     - `/layer/renderer/src/modules/multi-server/components/ServerHealthIndicator.tsx`

10. **Server Management Modal**
    - Create comprehensive server management UI
    - Implement server CRUD operations
    - Add bulk operations (export/import)
    - **File**: `/layer/renderer/src/modules/multi-server/components/ServerManagementModal.tsx`

11. **Header Server Switcher**
    - Create compact server switcher for header
    - Implement quick switching functionality
    - Add visual status indicators
    - **File**: `/layer/renderer/src/modules/multi-server/components/ServerSwitcher.tsx`

### Phase 4: Settings Integration (Days 9-10)

12. **Enhanced GeneralTab**
    - Update GeneralTab to show multi-server status
    - Add server management entry point
    - Maintain backward compatibility
    - **File**: Update `/layer/renderer/src/modules/modals/SettingsModal/tabs/GeneralTab.tsx`

13. **Settings Modal Integration**
    - Add optional "Servers" tab for advanced management
    - Implement conditional tab display
    - Update tab configuration
    - **Files**: 
      - Update `/layer/renderer/src/modules/modals/SettingsModal/configs.tsx`
      - Create `/layer/renderer/src/modules/multi-server/components/ServersTab.tsx`

### Phase 5: Onboarding & Migration (Days 11-12)

14. **Onboarding Enhancement**
    - Update onboarding to use multi-server system
    - Add multi-server feature hints
    - Implement automatic migration
    - **File**: Update relevant onboarding components

15. **Data Migration System**
    - Implement single-to-multi server migration
    - Add migration validation
    - Create fallback mechanisms
    - **File**: `/layer/renderer/src/modules/multi-server/utils/server-migration.ts`

### Phase 6: Integration & Polish (Days 13-14)

16. **UI Integration Points**
    - Integrate server switcher into header
    - Update connection atoms compatibility
    - Add server context to error handling
    - **Files**: Update header components and connection management

17. **Performance Optimization**
    - Implement query invalidation strategies
    - Add connection pooling optimizations
    - Optimize health check intervals
    - **Files**: Various optimization updates

18. **Error Handling & Edge Cases**
    - Add comprehensive error handling
    - Implement graceful degradation
    - Add connection timeout handling
    - **Files**: Throughout implementation

## Validation Gates

### Code Quality Checks
```bash
# TypeScript validation
cd layer/renderer && pnpm typecheck

# ESLint validation
pnpm lint

# Build validation
pnpm build
```

### Functional Testing
```bash
# Test multi-server store operations
# Verify server CRUD operations work correctly
# Validate health monitoring functionality
# Confirm query key scoping works

# Test server switching behavior  
# Ensure backward compatibility maintained
# Validate storage migration process
# Check error handling edge cases
```

### UI/UX Validation
```bash
# Visual regression testing
# Verify modal interactions work correctly
# Test responsive behavior
# Confirm accessibility compliance
# Validate touch/mobile interactions
```

### Integration Testing
```bash
# Test with existing torrent operations
# Verify settings modal integration
# Confirm onboarding flow works
# Test concurrent server connections
# Validate query cache isolation
```

## Gotchas & Critical Considerations

### State Management Gotchas

1. **Zustand Store Reference Stability**: Use `useCallback` for selectors and avoid inline object creation
2. **Jotai Atom Dependencies**: Ensure derived atoms properly depend on source atoms to avoid stale reads
3. **Query Key Scoping**: Server-scoped query keys must be properly namespaced to prevent cross-server data pollution

### Connection Management

1. **Client Instance Cleanup**: Properly dispose of unused client instances to prevent memory leaks
2. **Authentication State**: Handle authentication failures gracefully across multiple servers
3. **Concurrent Connections**: Limit concurrent health checks to prevent server overload

### Performance Considerations

1. **Health Check Optimization**: Use lightweight API calls (version check) rather than full data requests
2. **Query Invalidation**: Scope invalidations to active server only unless global refresh needed
3. **Storage Performance**: Debounce configuration saves to prevent excessive localStorage writes

### Backward Compatibility

1. **Existing Code Paths**: All existing `QBittorrentClient.shared` usage must continue working unchanged
2. **Storage Migration**: Handle malformed or incomplete legacy configurations gracefully  
3. **Error Fallbacks**: Provide single-server fallback mode if multi-server initialization fails

## Success Criteria

- ✅ All existing functionality works without modification
- ✅ Users can add unlimited server connections  
- ✅ Server switching happens within 2 seconds
- ✅ Health monitoring runs without performance impact
- ✅ UI remains responsive during server operations
- ✅ Configuration persists across app restarts
- ✅ Migration from single-server is seamless
- ✅ Error states provide clear user feedback

## PRP Quality Score: 9/10

**Confidence Level**: Very High - This PRP provides comprehensive context, detailed implementation guidance, clear validation criteria, and addresses all critical technical considerations for successful one-pass implementation.

**Deductions**: Minor complexity in state management integration patterns that may require iterative refinement during implementation.