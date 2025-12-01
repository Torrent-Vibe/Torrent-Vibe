// Mobile Layout Constants
export const MOBILE_LAYOUT_CONSTANTS = {
  // Header Heights
  HEADER_HEIGHT: 48,
  HEADER_HEIGHT_EXPANDED: 110,

  // List Item Heights
  CELL_HEIGHT: 64, // Standard iOS cell height
  CELL_HEIGHT_EXPANDED: 120, // When showing additional details

  // Spacing
  CELL_PADDING_HORIZONTAL: 16,
  CELL_PADDING_VERTICAL: 12,
  CELL_SEPARATOR_HEIGHT: 0.5,

  // Gestures
  SWIPE_THRESHOLD: 100,
  LONG_PRESS_DURATION: 500,
  PULL_TO_REFRESH_THRESHOLD: 120,

  // Selection
  MAX_SELECTION_COUNT: 1000,
  SELECTION_TIMEOUT: 2000,

  // Animation Durations (kept for essential transitions only)
  TRANSITION_FAST: 150,
  TRANSITION_NORMAL: 200,
  TRANSITION_SLOW: 300,

  // Bottom Sheet
  BOTTOM_SHEET_MAX_HEIGHT: '85vh',
  BOTTOM_SHEET_MIN_HEIGHT: '50vh',

  // Floating Action Button
  FAB_SIZE: 56,
  FAB_OFFSET: 24,

  // Breakpoints
  MOBILE_BREAKPOINT: 1024,
} as const

// iOS UITableView Cell Types
export const CELL_TYPES = {
  DEFAULT: 'default',
  SUBTITLE: 'subtitle',
  VALUE1: 'value1',
  VALUE2: 'value2',
} as const

// Cell Selection States
export const CELL_SELECTION_STATES = {
  NONE: 'none',
  SINGLE: 'single',
  MULTIPLE: 'multiple',
} as const

// Cell Accessory Types (iOS style)
export const CELL_ACCESSORY_TYPES = {
  NONE: 'none',
  DISCLOSURE_INDICATOR: 'disclosure',
  DETAIL_BUTTON: 'detail',
  CHECKMARK: 'checkmark',
  DETAIL_DISCLOSURE_BUTTON: 'detail-disclosure',
} as const

// Mobile Torrent Cell Display Modes
export const TORRENT_CELL_MODES = {
  COMPACT: 'compact',
  DETAILED: 'detailed',
} as const

export type MobileCellType = keyof typeof CELL_TYPES
export type CellSelectionState = keyof typeof CELL_SELECTION_STATES
export type CellAccessoryType = keyof typeof CELL_ACCESSORY_TYPES
export type TorrentCellMode = keyof typeof TORRENT_CELL_MODES
