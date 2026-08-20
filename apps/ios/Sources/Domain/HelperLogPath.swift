import Foundation

enum HelperLogPath {
  static let dataDirRelative = ".local/share/torrent-vibe-helper"
  static let logRelativePath = "logs/helper.log"

  static var filePath: String { "~/\(dataDirRelative)/\(logRelativePath)" }
}
