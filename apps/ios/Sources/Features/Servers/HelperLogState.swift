import Foundation
import Observation

@MainActor
@Observable
final class HelperLogState {
  private(set) var tab: HelperLogTab = .events
  private(set) var discovery: HelperDiscoveryInfo?
  private(set) var isLoadingDiscovery = false
  private(set) var events: [HelperEvent] = []
  private(set) var rawText = ""
  private(set) var isLoadingRaw = false
  private(set) var discoveryErrorMessage: String?
  private(set) var eventsErrorMessage: String?
  private(set) var rawErrorMessage: String?
  var level: HelperLogLevel = .info
  var search = ""

  private let model: AppModel
  private let serverID: UUID
  private let pollIntervalOverride: Duration?
  private var since: UInt64 = 0
  private var isVisible = false
  private var pollTask: Task<Void, Never>?

  init(model: AppModel, serverID: UUID, pollIntervalOverride: Duration? = nil) {
    self.model = model
    self.serverID = serverID
    self.pollIntervalOverride = pollIntervalOverride
  }

  var filteredEvents: [HelperEvent] {
    HelperEventsFiltering.apply(events, filter: HelperEventsFilter(level: level, search: search))
  }

  var isPollingEvents: Bool { pollTask != nil }

  var discoveryFailed: Bool { discovery == nil && discoveryErrorMessage != nil }

  func tabState(_ tab: HelperLogTab) -> HelperLogTabState {
    guard let discovery else { return .unavailable }
    return HelperLogTabGating.state(for: tab, discovery: discovery)
  }

  func loadDiscoveryIfNeeded() async {
    guard discovery == nil else { return }
    isLoadingDiscovery = true
    defer { isLoadingDiscovery = false }
    do {
      let info = try await model.helperDiscoveryInfo(for: serverID)
      discoveryErrorMessage = nil
      discovery = info
      tab = HelperLogTabGating.defaultTab(discovery: info)
      handleTabChanged()
    } catch {
      discoveryErrorMessage = error.localizedDescription
    }
  }

  func selectTab(_ newTab: HelperLogTab) {
    guard tab != newTab else { return }
    tab = newTab
    handleTabChanged()
  }

  func startVisible() {
    isVisible = true
    handleTabChanged()
  }

  func stopVisible() {
    isVisible = false
    pollTask?.cancel()
    pollTask = nil
  }

  func copyEventsText() -> String {
    filteredEvents
      .map { event in
        var line = "\(event.at) [\(event.level)] \(event.kind) \(event.message)"
        if let fields = event.fields, !fields.isEmpty {
          let fieldsText = fields
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value.displayText)" }
            .joined(separator: ", ")
          line += " {\(fieldsText)}"
        }
        return line
      }
      .joined(separator: "\n")
  }

  private func handleTabChanged() {
    pollTask?.cancel()
    pollTask = nil
    guard isVisible else { return }
    switch tab {
    case .events:
      guard tabState(.events) == .available else { return }
      startEventsPolling()
    case .raw:
      guard tabState(.raw) == .available else { return }
      Task { await loadRaw() }
    }
  }

  private func startEventsPolling() {
    guard pollTask == nil else { return }
    pollTask = Task { [weak self] in
      guard let self else { return }
      while !Task.isCancelled {
        await self.fetchEventsPage()
        guard !Task.isCancelled else { return }
        try? await Task.sleep(for: self.pollInterval)
      }
    }
  }

  private var pollInterval: Duration { pollIntervalOverride ?? .milliseconds(2000) }

  private func fetchEventsPage() async {
    guard isVisible, tab == .events else { return }
    do {
      let page = try await model.helperEvents(
        for: serverID, since: since, level: nil, replicaID: nil, limit: nil)
      guard isVisible, tab == .events else { return }
      events = HelperEventsCursor.merge(held: events, page: page.events)
      since = page.cursor
      eventsErrorMessage = nil
    } catch {
      guard isVisible, tab == .events else { return }
      eventsErrorMessage = error.localizedDescription
    }
  }

  private func loadRaw() async {
    guard isVisible, tab == .raw else { return }
    isLoadingRaw = true
    defer { isLoadingRaw = false }
    do {
      let text = try await model.helperLogs(for: serverID, tail: 500)
      guard isVisible, tab == .raw else { return }
      rawText = text
      rawErrorMessage = nil
    } catch {
      guard isVisible, tab == .raw else { return }
      rawErrorMessage = error.localizedDescription
    }
  }
}
