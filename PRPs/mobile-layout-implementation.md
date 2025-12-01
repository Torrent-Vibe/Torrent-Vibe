# Mobile Layout Implementation PRP

## Overview

Implement a comprehensive iOS-style mobile layout for the qBittorrent WebUI, replacing the desktop table-based interface with a mobile-optimized card-based list. This PRP transforms the existing stub `src/modules/layout/mobile/Layout.tsx` into a fully functional mobile interface.

## Research Context & Findings

### Existing Architecture Analysis

The codebase already has mobile infrastructure in place:

- **Mobile Detection**: `useMobile()` hook exists (`/src/hooks/common/useMobile.ts`) - uses < 1024px breakpoint
- **Responsive Pattern**: `ResponsiveSelect` component shows conditional rendering pattern
- **Layout Switch**: Main page (`/src/pages/(main)/index.sync.tsx`) already switches between layouts:
  ```tsx
  const isMobile = useMobile()
  return isMobile ? <MobileLayout /> : <DesktopLayout />
  ```
- **Stub Exists**: `/src/modules/layout/mobile/Layout.tsx` contains minimal implementation

### Key Dependencies Available

- **Vaul 1.1.2**: Bottom sheet/drawer library (unused, perfect for mobile detail panels)
- **TanStack Virtual 3.13.12**: List virtualization (already used in desktop table)
- **Motion 12.23.12**: Animation library (Framer Motion - already used)
- **State Management**: Zustand + Jotai stores already implemented

### External Research Insights

#### Vaul Best Practices
- **Documentation**: https://vaul.emilkowal.ski/
- **GitHub**: https://github.com/emilkowalski/vaul
- **Usage Pattern**: Responsive drawer (dialog on desktop, drawer on mobile)
- **Key Features**: Snap points, native iOS-like experience, drag-to-dismiss
- **Implementation**: Built on Radix Dialog primitive for accessibility

#### TanStack Virtual Optimization
- **Documentation**: https://tanstack.com/virtual/latest
- **Mobile Considerations**: Dynamic sizing, responsive columns, performance optimization
- **Best Practices**: Debounced scroll events, memory management, absolute positioning
- **Architecture**: Only visible items rendered, 60fps performance guarantee

#### iOS Card Design Patterns
- **Visual Hierarchy**: Primary info always visible, secondary info expandable
- **Touch Interaction**: 44px minimum touch targets, swipe gestures
- **Content Strategy**: Single concept per card, minimal text, reasonable whitespace
- **Responsive**: Adapts to different screen sizes, vertical layout optimization

## Implementation Blueprint

### Component Architecture

```
/src/modules/layout/mobile/
├── Layout.tsx (main layout - EXISTING STUB)
├── components/
│   ├── MobileHeader.tsx (compact 48px header)
│   ├── MobileNavDrawer.tsx (hamburger menu actions)
│   ├── MobileTorrentList.tsx (virtualized card list)
│   ├── MobileTorrentCard.tsx (iOS-style torrent card)
│   ├── MobileDetailBottomSheet.tsx (Vaul drawer for details)
│   └── MobileFloatingActionButton.tsx (quick add torrent)
├── hooks/
│   ├── useMobileGestures.ts (swipe, tap, long press)
│   ├── useMobileTorrentList.ts (virtualization setup)
│   └── useMobileSelection.ts (multi-select mode)
└── atoms/
    └── mobile-layout.ts (mobile-specific state)
```

### Data Transformation Strategy

**Desktop Table → Mobile Cards Mapping:**

| Desktop Column | Mobile Card Position | Display Priority |
|---------------|---------------------|------------------|
| name | Card title | Primary (always visible) |
| state | Status indicator | Primary (colored dot) |
| progress | Progress bar | Primary (full width) |
| size | Progress subtitle | Primary (downloaded/total) |
| dlspeed/upspeed | Speed indicators | Secondary (icon + value) |
| eta | Right side of speed row | Secondary |
| ratio, seeds, peers | Expandable section | Tertiary (tap to expand) |
| category, tags | Expandable section | Tertiary (tags/labels) |

### State Management Integration

**Reuse Existing Patterns:**
```typescript
// Leverage existing stores
import { useTorrentDataStore } from '~/modules/torrent/stores'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

// Add mobile-specific atoms
const mobileLayoutAtom = atom({
  drawerOpen: false,
  searchExpanded: false,
  bottomSheetOpen: false,
  selectedCard: null,
  expandedCards: new Set<string>()
})
```

## Implementation Tasks (Execution Order)

### Phase 1: Core Infrastructure
1. **Create mobile layout atoms** (`/src/modules/layout/mobile/atoms/mobile-layout.ts`)
2. **Implement MobileHeader component** with compact design and hamburger menu
3. **Update main Layout.tsx** to use proper mobile layout structure
4. **Add Vaul bottom sheet integration** for detail panel replacement

### Phase 2: Card-based List System  
5. **Create MobileTorrentCard component** with iOS-style design
6. **Implement MobileTorrentList** with TanStack Virtual integration
7. **Add mobile gesture handling** (tap, long press, swipe)
8. **Create mobile selection system** (long press to enter multi-select)

### Phase 3: Navigation & Actions
9. **Build MobileNavDrawer** using Vaul for slide-out menu
10. **Implement MobileDetailBottomSheet** for torrent details
11. **Add MobileFloatingActionButton** for quick torrent addition
12. **Create mobile toolbar** with filter tabs and search

### Phase 4: Polish & Optimization
13. **Add mobile-specific animations** using Motion library
14. **Implement responsive breakpoints** and progressive enhancement
15. **Optimize performance** for mobile devices
16. **Test accessibility** and touch interactions

## Key Implementation Details

### Mobile Header Design
```typescript
// 48px height (vs 60px desktop), hamburger menu
interface MobileHeaderProps {
  className?: string
  showSearch?: boolean
  isSearchExpanded?: boolean
  onToggleSearch?: () => void
  onToggleDrawer?: () => void
}
```

### Card Component Structure
```typescript
// iOS-style card with collapsible sections
interface MobileTorrentCardProps {
  rowIndex: number
  isSelected?: boolean
  isExpanded?: boolean
  onTap?: () => void
  onLongPress?: () => void
  onSwipeLeft?: () => void  // delete
  onSwipeRight?: () => void // toggle state
}
```

### Vaul Integration Pattern
```typescript
// Bottom sheet for detail panel
import { Drawer } from 'vaul'

<Drawer.Root open={isDetailOpen} onOpenChange={setDetailOpen}>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
    <Drawer.Content className="bg-background flex flex-col rounded-t-[10px] mt-24 fixed bottom-0 left-0 right-0">
      <Drawer.Handle className="mx-auto w-12 h-1.5 rounded-full bg-border mb-8" />
      <DetailPanelContent /> {/* Reuse existing component */}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### Virtualization Setup
```typescript
// Mobile-optimized virtualization
const MOBILE_CARD_HEIGHT = 120
const MOBILE_EXPANDED_HEIGHT = 180

const virtualization = useVirtualizer({
  count: torrentsLength,
  getScrollElement: () => scrollElementRef.current,
  estimateSize: useCallback((index) => {
    const isExpanded = expandedCards.has(getTorrentHash(index))
    return isExpanded ? MOBILE_EXPANDED_HEIGHT : MOBILE_CARD_HEIGHT
  }, [expandedCards]),
  overscan: 5, // Reduced for mobile
})
```

## File Reference Patterns

### Follow Existing Conventions

**Desktop Layout Structure** (`/src/modules/layout/desktop/components/Layout.tsx`):
- Component composition pattern
- State management integration  
- Error boundary handling
- Animation integration

**Responsive Component Pattern** (`/src/components/ui/select/ResponsiveSelect.tsx`):
```typescript
const isMobile = useMobile()
if (isMobile) {
  return <MobileImplementation />
}
return <DesktopImplementation />
```

**Torrent Store Integration** (`/src/modules/torrent/stores/`):
- Reuse existing selectors
- Follow performance patterns
- Use deferred values for list items

**Module Organization** (Follow `/src/modules/torrent/` structure):
- components/ for UI components
- hooks/ for custom logic  
- stores/ for state (if needed)
- atoms/ for Jotai state

## Validation Gates

### Build Validation
```bash
# TypeScript validation
pnpm typecheck

# Code quality validation  
pnpm lint

# Build validation
pnpm build
```

### Manual Testing Checklist
- [ ] Mobile layout renders correctly on < 1024px screens
- [ ] Card list scrolls smoothly with virtualization
- [ ] Tap/long press gestures work correctly
- [ ] Bottom sheet opens/closes with proper animations
- [ ] Navigation drawer functions properly
- [ ] All torrent data displays correctly in card format
- [ ] Multi-select mode works with long press
- [ ] Search and filters function in mobile layout
- [ ] Theme switching works correctly
- [ ] Responsive breakpoints transition smoothly

### Performance Targets
- [ ] 60fps scrolling on mobile devices
- [ ] < 100ms interaction response time
- [ ] Virtualized list handles 1000+ torrents smoothly
- [ ] Memory usage remains stable during extended scrolling
- [ ] Animation performance maintains 60fps

## Potential Gotchas & Solutions

### TanStack Virtual Mobile Issues
**Problem**: Virtualization can cause scroll position jumping
**Solution**: Use `scrollMargin` and proper `estimateSize` functions

### Vaul Drawer Conflicts  
**Problem**: Multiple drawers might conflict
**Solution**: Use single drawer state management with content switching

### Touch Event Handling
**Problem**: Conflicts between scroll, tap, and swipe
**Solution**: Proper event delegation and gesture recognition timing

### State Synchronization
**Problem**: Mobile and desktop states might desync
**Solution**: Share same Zustand stores, only UI components differ

### Animation Performance
**Problem**: Too many simultaneous animations on mobile
**Solution**: Use `useDeferredValue` and `useTransition` for non-critical animations

## Success Criteria

### Functional Requirements
- [x] Mobile layout switches automatically at < 1024px
- [x] Torrent data displays in iOS-style cards
- [x] Bottom sheet replaces desktop detail panel
- [x] Navigation drawer replaces desktop toolbar actions
- [x] Touch gestures work intuitively
- [x] List virtualization handles large datasets
- [x] Search and filtering work on mobile

### User Experience Requirements  
- [x] Native iOS-like interaction patterns
- [x] Smooth 60fps animations and scrolling
- [x] Intuitive card expansion/collapse
- [x] Proper touch target sizes (44px minimum)
- [x] Accessible navigation and interactions
- [x] Consistent visual design with desktop

### Technical Requirements
- [x] TypeScript compliance with existing patterns
- [x] Performance optimized for mobile devices  
- [x] Reuses existing state management
- [x] Follows established component patterns
- [x] Maintains code organization standards

## PRP Confidence Score: 9/10

**High Confidence Factors:**
- Existing mobile infrastructure (useMobile, layout switching)
- All required libraries already installed (Vaul, TanStack Virtual, Motion)
- Clear existing patterns to follow (ResponsiveSelect, desktop Layout)
- Comprehensive research and implementation plan
- Well-defined component boundaries and state management

**Minor Risk Factor:**
- First-time Vaul integration (mitigated by excellent documentation and examples)

This PRP provides comprehensive context for one-pass implementation success, with clear patterns, detailed technical specifications, and thorough validation criteria.