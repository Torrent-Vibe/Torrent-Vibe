import Foundation

enum HelperEventsCursor {
  static let maxHeldEvents = 2000

  static func merge(held: [HelperEvent], page: [HelperEvent]) -> [HelperEvent] {
    guard !page.isEmpty else { return held }
    let seen = Set(held.map(\.seq))
    let maxHeldSeq = held.map(\.seq).max() ?? 0
    let additions = page.filter { $0.seq > maxHeldSeq && !seen.contains($0.seq) }
    guard !additions.isEmpty else { return held }
    let merged = held + additions
    guard merged.count > maxHeldEvents else { return merged }
    return Array(merged.suffix(maxHeldEvents))
  }
}
