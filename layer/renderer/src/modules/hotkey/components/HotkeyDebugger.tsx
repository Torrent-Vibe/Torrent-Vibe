import * as React from 'react'
import { useEffect, useState } from 'react'

import { useHotkeyContext } from '../providers/HotkeyProvider'
import type { FocusContext, HotkeyDebugInfo, ResolvedHotkey } from '../types'

interface HotkeyDebuggerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  width?: number
  maxHeight?: number
  refreshInterval?: number
}

export function HotkeyDebugger({
  position = 'top-right',
  width = 400,
  maxHeight = 600,
  refreshInterval = 1000,
}: HotkeyDebuggerProps) {
  const { manager, isEnabled } = useHotkeyContext()
  const [debugInfo, setDebugInfo] = useState<HotkeyDebugInfo | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [activeTab, setActiveTab] = useState<
    'scopes' | 'hotkeys' | 'focus' | 'performance'
  >('hotkeys')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (!isVisible) return

    const updateDebugInfo = () => {
      setDebugInfo(manager.getDebugInfo())
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, refreshInterval)

    return () => clearInterval(interval)
  }, [manager, isVisible, refreshInterval])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle with Ctrl+Shift+D
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setIsVisible(!isVisible)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  if (!isVisible || !debugInfo) return null

  const positionStyles = {
    'top-right': { top: 10, right: 10 },
    'top-left': { top: 10, left: 10 },
    'bottom-right': { bottom: 10, right: 10 },
    'bottom-left': { bottom: 10, left: 10 },
  }

  const filteredHotkeys = Array.from(
    debugInfo.registeredHotkeys.entries(),
  ).filter(([combo, hotkey]) => {
    if (!filter) return true
    const searchText = filter.toLowerCase()
    return (
      combo.toLowerCase().includes(searchText) ||
      hotkey.scopeId.toLowerCase().includes(searchText) ||
      hotkey.description?.toLowerCase().includes(searchText) ||
      hotkey.category?.toLowerCase().includes(searchText)
    )
  })

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        width,
        maxHeight,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        color: 'white',
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: 'monospace',
        fontSize: 12,
        zIndex: 10000,
        border: '1px solid #333',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #333',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 'bold' }}>
          Hotkey Debugger {(!isEnabled && <span>(Disabled)</span>) || null}
        </h3>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #333',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        {['hotkeys', 'scopes', 'focus', 'performance'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab as any)}
            style={{
              background:
                activeTab === tab ? 'rgba(255, 255, 255, 0.1)' : 'none',
              border: 'none',
              color: 'white',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 11,
              textTransform: 'capitalize',
              borderBottom:
                activeTab === tab
                  ? '2px solid #007acc'
                  : '2px solid transparent',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: 16,
          maxHeight: maxHeight - 120,
          overflow: 'auto',
        }}
      >
        {activeTab === 'hotkeys' && (
          <HotkeyTab
            hotkeys={filteredHotkeys}
            filter={filter}
            setFilter={setFilter}
            totalCount={debugInfo.registeredHotkeys.size}
          />
        )}
        {activeTab === 'scopes' && (
          <ScopeTab
            activeScopes={debugInfo.activeScopes}
            scopeHierarchy={debugInfo.scopeHierarchy}
          />
        )}
        {activeTab === 'focus' && (
          <FocusTab focusContext={debugInfo.focusContext!} />
        )}
        {activeTab === 'performance' && (
          <PerformanceTab metrics={debugInfo.performanceMetrics} />
        )}
      </div>

      <div
        style={{
          padding: '8px 16px',
          borderTop: '1px solid #333',
          fontSize: 10,
          color: '#888',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      >
        Press Ctrl+Shift+D to toggle | Updated every {refreshInterval}ms
      </div>
    </div>
  )
}

function HotkeyTab({
  hotkeys,
  filter,
  setFilter,
  totalCount,
}: {
  hotkeys: [string, ResolvedHotkey][]
  filter: string
  setFilter: (filter: string) => void
  totalCount: number
}) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Filter hotkeys..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid #333',
            borderRadius: 4,
            color: 'white',
            fontSize: 11,
          }}
        />
        <div style={{ marginTop: 4, color: '#888', fontSize: 10 }}>
          Showing {hotkeys.length} of {totalCount} hotkeys
        </div>
      </div>

      <div style={{ maxHeight: 350, overflow: 'auto' }}>
        {hotkeys.map(([combo, hotkey]) => (
          <div
            key={`${hotkey.scopeId}-${combo}`}
            style={{
              marginBottom: 8,
              padding: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 4,
              border: hotkey.disabled
                ? '1px solid #666'
                : '1px solid transparent',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <code
                style={{
                  fontWeight: 'bold',
                  color: hotkey.disabled ? '#888' : '#4fc3f7',
                  fontSize: 11,
                }}
              >
                {combo}
              </code>
              <span
                style={{
                  fontSize: 10,
                  color: '#888',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}
              >
                {hotkey.scopeId}
              </span>
            </div>

            {hotkey.description && (
              <div style={{ fontSize: 10, color: '#ccc', marginBottom: 2 }}>
                {hotkey.description}
              </div>
            )}

            <div style={{ fontSize: 10, color: '#666' }}>
              <span>Priority: {hotkey.priority}</span>
              <span> | Reason: {hotkey.resolutionReason}</span>
              {hotkey.category ? (
                <span> | Category: {hotkey.category}</span>
              ) : null}
              {hotkey.preventDefault ? <span> preventDefault</span> : null}
              {hotkey.stopPropagation ? <span> stopPropagation</span> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ScopeTab({
  activeScopes,
  scopeHierarchy,
}: {
  activeScopes: string[]
  scopeHierarchy: any[]
}) {
  const getScopeTree = () => {
    const tree: any = {}
    scopeHierarchy.forEach((scope) => {
      if (!scope.parentId) {
        tree[scope.id] = { ...scope, children: {} }
      }
    })

    scopeHierarchy.forEach((scope) => {
      if (scope.parentId && tree[scope.parentId]) {
        tree[scope.parentId].children[scope.id] = { ...scope, children: {} }
      }
    })

    return tree
  }

  const renderScope = (scope: any, depth = 0) => (
    <div key={scope.id} style={{ marginLeft: depth * 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          marginBottom: 2,
          backgroundColor: activeScopes.includes(scope.id)
            ? 'rgba(76, 175, 80, 0.2)'
            : 'rgba(255, 255, 255, 0.05)',
          borderRadius: 4,
          borderLeft: activeScopes.includes(scope.id)
            ? '3px solid #4caf50'
            : '3px solid transparent',
        }}
      >
        <span
          style={{
            color: activeScopes.includes(scope.id) ? '#4caf50' : '#ccc',
            fontWeight: activeScopes.includes(scope.id) ? 'bold' : 'normal',
          }}
        >
          {scope.id}
        </span>
        <span style={{ marginLeft: 8, fontSize: 10, color: '#666' }}>
          (priority: {scope.priority}, strategy: {scope.strategy})
        </span>
      </div>
      {Object.values(scope.children).map((child: any) =>
        renderScope(child, depth + 1),
      )}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 11 }}>
        <strong>Active Scopes ({activeScopes.length}):</strong>
        <div style={{ color: '#4caf50', marginTop: 4 }}>
          {activeScopes.join(' → ')}
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 'bold' }}>
        Scope Hierarchy:
      </div>
      {Object.values(getScopeTree()).map((scope: any) => renderScope(scope))}
    </div>
  )
}

function FocusTab({ focusContext }: { focusContext: FocusContext }) {
  return (
    <div>
      {focusContext ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong>Current Scope:</strong> {focusContext.scopeId}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Priority:</strong> {focusContext.priority}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Scope Path:</strong>
            <div style={{ marginTop: 4, color: '#4fc3f7' }}>
              {focusContext.scopePath.join(' → ')}
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Element:</strong>
            <div style={{ marginTop: 4, fontSize: 10, color: '#ccc' }}>
              {focusContext.element.tagName.toLowerCase()}
              {focusContext.element.className ? (
                <span>
                  .{focusContext.element.className.split(' ').join('.')}
                </span>
              ) : null}
              {focusContext.element.id ? (
                <span>#{focusContext.element.id}</span>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: '#888', fontStyle: 'italic' }}>
          No focus context available
        </div>
      )}
    </div>
  )
}

function PerformanceTab({ metrics }: { metrics: any }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <strong>FPS:</strong> {metrics.fps}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>CPU Usage:</strong> {metrics.cpuUsage}%
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Memory Usage:</strong> {metrics.memoryUsage} MB
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Hotkey Latency:</strong> {metrics.hotkeyLatency.toFixed(2)}ms
      </div>
    </div>
  )
}
