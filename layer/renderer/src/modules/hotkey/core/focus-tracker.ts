import type { FocusContext } from '../types'
import { HotkeyScope } from '../types'
import { hotkeyManager } from './hotkey-manager-core'

export type FocusChangeListener = (
  context: FocusContext | null,
  previousContext: FocusContext | null,
) => void

export class FocusTracker {
  private currentContext: FocusContext | null = null
  private focusHistory: FocusContext[] = []
  private listeners = new Set<FocusChangeListener>()
  private pendingUpdate: number | null = null
  private debounceDelay = 16 // One frame

  // Performance optimizations
  private visibilityObserver!: IntersectionObserver
  private visibleElements = new Set<HTMLElement>()
  private resizeObserver!: ResizeObserver

  // Navigation pattern tracking for prediction
  private navigationPattern: string[] = []
  private patternCache = new Map<string, string[]>()

  constructor() {
    this.initializeOptimizedTracking()
    this.setupVisibilityOptimization()
    this.setupResizeOptimization()
  }

  private initializeOptimizedTracking(): void {
    // Use passive event listeners for better performance
    document.addEventListener('focusin', this.debouncedHandleFocus, {
      passive: true,
    })
    document.addEventListener('focusout', this.debouncedHandleFocus, {
      passive: true,
    })

    // Mouse events for cases where focus doesn't trigger
    document.addEventListener('mousedown', this.debouncedHandleMouseDown, {
      passive: true,
    })
    document.addEventListener('click', this.debouncedHandleClick, {
      passive: true,
    })

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyNavigation, {
      passive: true,
    })
  }

  private setupVisibilityOptimization(): void {
    // Only track focus changes for visible elements
    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.visibleElements.add(entry.target as HTMLElement)
          } else {
            this.visibleElements.delete(entry.target as HTMLElement)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '50px', // Preload slightly off-screen elements
      },
    )
  }

  private setupResizeOptimization(): void {
    // Track element size changes that might affect focus
    this.resizeObserver = new ResizeObserver((entries) => {
      // Debounce resize events
      if (this.pendingUpdate) return

      this.pendingUpdate = requestAnimationFrame(() => {
        // Recheck focus context if current focused element resized
        const currentElement = this.currentContext?.element
        const resizedElement = entries.find(
          (entry) => entry.target === currentElement,
        )

        if (resizedElement && currentElement) {
          this.handleFocusChange(currentElement)
        }

        this.pendingUpdate = null
      })
    })
  }

  // Debounced event handlers
  private debouncedHandleFocus = (event: FocusEvent) => {
    this.debounceUpdate(() => {
      this.handleFocusChange(event.target as HTMLElement)
    })
  }

  private debouncedHandleMouseDown = (event: MouseEvent) => {
    this.debounceUpdate(() => {
      this.handleFocusChange(event.target as HTMLElement)
    })
  }

  private debouncedHandleClick = (event: MouseEvent) => {
    this.debounceUpdate(() => {
      this.handleFocusChange(event.target as HTMLElement)
    })
  }

  private handleKeyNavigation = (event: KeyboardEvent) => {
    // Handle Tab navigation, arrow keys, etc.
    const navigationKeys = [
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ]

    if (navigationKeys.includes(event.key)) {
      // Slightly delay to let focus settle
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement
        if (activeElement) {
          this.handleFocusChange(activeElement)
        }
      }, 10)
    }
  }

  private debounceUpdate(callback: () => void): void {
    if (this.pendingUpdate) {
      cancelAnimationFrame(this.pendingUpdate)
    }

    this.pendingUpdate = requestAnimationFrame(() => {
      callback()
      this.pendingUpdate = null
    })
  }

  private handleFocusChange(element: HTMLElement | null): void {
    if (!element) {
      this.updateCurrentContext(null)
      return
    }

    // Fast path: Check if element is visible
    if (!this.isElementVisible(element)) {
      return
    }

    // Fast path: Check if same as current context
    const newContext = this.resolveContextFromElement(element)

    if (this.isSameContext(newContext, this.currentContext)) {
      return
    }

    this.updateCurrentContext(newContext)
  }

  private isElementVisible(element: HTMLElement): boolean {
    // Fast checks first
    if (element.offsetParent === null) return false
    if (element.style.display === 'none') return false
    if (element.style.visibility === 'hidden') return false

    // Check intersection observer cache
    return (
      this.visibleElements.has(element) || this.isElementInViewport(element)
    )
  }

  private isElementInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  private resolveContextFromElement(element: HTMLElement): FocusContext | null {
    let current: HTMLElement | null = element
    const scopePath: HotkeyScope[] = [HotkeyScope.GLOBAL]
    let mostSpecificScope: {
      element: HTMLElement
      scopeId: string
      priority: number
    } | null = null

    // Walk up the DOM tree to find scope markers
    while (current) {
      const scopeId = current.dataset.hotkeyScope

      if (scopeId) {
        const scope = hotkeyManager.getScopeDefinition(scopeId)

        if (!scope) {
          current = current.parentElement
          continue
        }
        scopePath.unshift(scopeId as HotkeyScope)

        // Track the most specific (highest priority) scope
        if (!mostSpecificScope || scope.priority > mostSpecificScope.priority) {
          mostSpecificScope = {
            element: current,
            scopeId,
            priority: scope.priority,
          }
        }
      }

      current = current.parentElement
    }

    if (!mostSpecificScope) {
      return null
    }

    // Build final scope path, removing duplicates
    const uniqueScopePath = [...new Set(scopePath.reverse())] as HotkeyScope[]

    return {
      element: mostSpecificScope.element,
      scopeId: mostSpecificScope.scopeId,
      scopePath: uniqueScopePath,
      priority: mostSpecificScope.priority,
    }
  }

  private isSameContext(
    ctx1: FocusContext | null,
    ctx2: FocusContext | null,
  ): boolean {
    if (!ctx1 && !ctx2) return true
    if (!ctx1 || !ctx2) return false

    return ctx1.scopeId === ctx2.scopeId && ctx1.element === ctx2.element
  }

  private updateCurrentContext(newContext: FocusContext | null): void {
    const previousContext = this.currentContext
    this.currentContext = newContext

    // Keep hotkey manager in sync with latest focus context
    hotkeyManager.updateFocusContext(newContext)

    // Update focus history for pattern tracking
    if (newContext) {
      this.focusHistory.push(newContext)
      if (this.focusHistory.length > 10) {
        this.focusHistory.shift()
      }

      // Update navigation pattern
      this.updateNavigationPattern(newContext)
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(newContext, previousContext)
      } catch (error) {
        console.error('[FocusTracker] Error in focus listener:', error)
      }
    })

    // Start observing new element
    if (newContext?.element) {
      this.visibilityObserver.observe(newContext.element)
      this.resizeObserver.observe(newContext.element)
    }

    // Stop observing old element if different
    if (
      previousContext?.element &&
      previousContext.element !== newContext?.element
    ) {
      this.visibilityObserver.unobserve(previousContext.element)
      this.resizeObserver.unobserve(previousContext.element)
    }
  }

  private updateNavigationPattern(context: FocusContext): void {
    this.navigationPattern.push(context.scopeId)
    if (this.navigationPattern.length > 5) {
      this.navigationPattern.shift()
    }
  }

  addListener(listener: FocusChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Cleanup
  destroy(): void {
    document.removeEventListener('focusin', this.debouncedHandleFocus)
    document.removeEventListener('focusout', this.debouncedHandleFocus)
    document.removeEventListener('mousedown', this.debouncedHandleMouseDown)
    document.removeEventListener('click', this.debouncedHandleClick)
    document.removeEventListener('keydown', this.handleKeyNavigation)

    if (this.pendingUpdate) {
      cancelAnimationFrame(this.pendingUpdate)
    }

    this.visibilityObserver.disconnect()
    this.resizeObserver.disconnect()

    this.listeners.clear()
    this.focusHistory.length = 0
    this.navigationPattern.length = 0
    this.patternCache.clear()
  }
}
