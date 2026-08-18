import Foundation

enum TorrentInput {
  static func tags(from text: String) -> [String] {
    var seen = Set<String>()
    return
      text
      .split(separator: ",", omittingEmptySubsequences: false)
      .compactMap { value in
        let tag = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !tag.isEmpty, seen.insert(tag).inserted else { return nil }
        return tag
      }
  }

  static func optionalBytesPerSecond(from mebibytesText: String) throws -> Int64? {
    let text = mebibytesText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return nil }
    return try bytesPerSecond(from: text)
  }

  static func bytesPerSecond(from mebibytesText: String) throws -> Int64 {
    let normalized =
      mebibytesText
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: ",", with: ".")
    guard let mebibytes = Double(normalized), mebibytes >= 0, mebibytes.isFinite else {
      throw TorrentInputError.invalidSpeedLimit
    }
    let bytes = mebibytes * 1_048_576
    guard bytes <= Double(Int64.max) else {
      throw TorrentInputError.invalidSpeedLimit
    }
    return Int64(bytes.rounded())
  }

  static func mebibytesText(for bytesPerSecond: Int64) -> String {
    guard bytesPerSecond > 0 else { return "0" }
    let value = Double(bytesPerSecond) / 1_048_576
    if value.rounded() == value {
      return String(Int64(value))
    }
    return value.formatted(.number.precision(.fractionLength(0...2)))
  }

  static func formattedSpeedLimit(_ bytesPerSecond: Int64) -> String {
    guard bytesPerSecond > 0 else { return "不限制" }
    let formatter = ByteCountFormatter()
    formatter.countStyle = .binary
    formatter.allowedUnits = [.useKB, .useMB, .useGB]
    formatter.isAdaptive = true
    return "\(formatter.string(fromByteCount: bytesPerSecond))/s"
  }
}

enum TorrentInputError: LocalizedError {
  case invalidSpeedLimit

  var errorDescription: String? {
    "速度限制应使用 MB/s，且必须是大于或等于 0 的数值。"
  }
}
