import UIKit

enum AppearanceMode: String, CaseIterable, Identifiable {
  case system
  case light
  case dark

  var id: Self { self }

  var label: String {
    switch self {
    case .system: String(localized: "跟随系统")
    case .light: String(localized: "浅色")
    case .dark: String(localized: "深色")
    }
  }

  var userInterfaceStyle: UIUserInterfaceStyle {
    switch self {
    case .system: .unspecified
    case .light: .light
    case .dark: .dark
    }
  }
}
