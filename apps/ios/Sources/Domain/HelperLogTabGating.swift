import Foundation

enum HelperLogTab: String, CaseIterable, Hashable, Sendable {
  case events
  case raw
}

enum HelperLogTabState: Hashable, Sendable {
  case available
  case unavailable
}

enum HelperLogTabGating {
  static func state(for tab: HelperLogTab, discovery: HelperDiscoveryInfo) -> HelperLogTabState {
    let supported = tab == .events ? discovery.supports(.events) : discovery.supports(.logs)
    return supported ? .available : .unavailable
  }

  static func defaultTab(discovery: HelperDiscoveryInfo) -> HelperLogTab {
    if discovery.supports(.events) {
      return .events
    }
    if discovery.supports(.logs) {
      return .raw
    }
    return .events
  }
}
