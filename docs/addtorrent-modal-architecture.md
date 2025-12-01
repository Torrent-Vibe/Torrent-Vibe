# AddTorrentModal Architecture

## Overview

The AddTorrentModal has been refactored into a clean, modular architecture that separates concerns and improves maintainability. The modal now uses a responsive design pattern that switches between desktop and mobile implementations.

## File Structure

```
AddTorrentModal/
├── AddTorrentModal.tsx              # Main entry point and responsive switcher
├── components/                      # Shared UI components
│   ├── index.ts                    # Component exports
│   ├── InputSourceSection.tsx      # Input source UI (magnet links & files)
│   └── SettingsSection.tsx         # Settings configuration UI
├── desktop/
│   └── AddTorrentModalDesktop.tsx  # Desktop-specific implementation
├── mobile/
│   └── AddTorrentModalMobile.tsx   # Mobile-specific implementation
└── shared/
    ├── types.ts                    # Shared TypeScript interfaces
    └── useAddTorrentLogic.ts       # Shared business logic hook
```

## Architecture Pattern

### 1. **Responsive Switcher Pattern**
The main `AddTorrentModal.tsx` acts as a smart component that:
- Detects screen size using `useMobile()` hook
- Delegates rendering to appropriate platform-specific component
- Shares common logic through the `useAddTorrentLogic` hook

### 2. **Shared Business Logic**
`useAddTorrentLogic.ts` contains all the common functionality:
- Form state management
- API calls and error handling
- Category loading
- Magnet link prefilling
- Submit logic

### 3. **Platform-Specific UI**
- **Desktop**: Traditional side-by-side layout
- **Mobile**: Two-step wizard with navigation

### 4. **Reusable UI Components**
- **InputSourceSection**: Handles magnet links and file uploads
- **SettingsSection**: Manages torrent configuration options

## Component Responsibilities

### Main Components

#### `AddTorrentModal` (Entry Point)
- Responsive detection
- Logic initialization
- Platform-specific rendering

#### `AddTorrentModalDesktop`
- Desktop-specific layout
- Side-by-side input/settings display
- Traditional form submission

#### `AddTorrentModalMobile`
- Mobile-specific step-by-step interface
- Step indicator and navigation
- Progressive disclosure pattern

### Shared Components

#### `InputSourceSection`
- Magnet link textarea
- File upload area
- Input validation UI

#### `SettingsSection`
- Torrent configuration options
- Scrollable settings container
- Category and tag management

### Hooks and Logic

#### `useAddTorrentLogic`
- Form state management
- API integration
- Error handling
- Category loading
- Initial data setup

## Benefits of This Architecture

### 1. **Separation of Concerns**
- UI logic separated from business logic
- Platform-specific code isolated
- Reusable components extracted

### 2. **Maintainability**
- Single responsibility principle
- Easy to modify desktop vs mobile behavior
- Clear dependency relationships

### 3. **Testability**
- Business logic can be tested independently
- UI components can be tested in isolation
- Platform-specific behavior is contained

### 4. **Type Safety**
- Comprehensive TypeScript interfaces
- Proper type definitions for all props
- Compile-time error checking

### 5. **Performance**
- Only loads platform-specific code
- Shared logic prevents duplication
- Efficient re-rendering patterns

## Usage Examples

### Basic Usage
```tsx
<AddTorrentModal 
  dismiss={handleDismiss}
  initialFiles={files}
  initialMagnetLinks={magnetLinks}
/>
```

### Custom Integration
```tsx
// The modal automatically adapts based on screen size
const MyComponent = () => {
  const isMobile = useMobile()
  
  return (
    <div>
      {/* Modal renders appropriate UI automatically */}
      <AddTorrentModal {...props} />
      
      {/* Other components can also use the shared logic */}
      <MyCustomForm useAddTorrentLogic={useAddTorrentLogic} />
    </div>
  )
}
```

## Migration Guide

The refactored modal maintains 100% API compatibility with the previous version:

- Same props interface
- Same modal behavior
- Same form functionality
- Same validation rules

No changes required in consuming components.

## Future Enhancements

This architecture enables easy future improvements:

1. **Additional Platforms**: Easy to add tablet-specific layouts
2. **A/B Testing**: Simple to test different UI approaches
3. **Feature Flags**: Platform-specific feature rollouts
4. **Accessibility**: Dedicated accessibility implementations per platform
5. **Theming**: Platform-specific styling approaches
