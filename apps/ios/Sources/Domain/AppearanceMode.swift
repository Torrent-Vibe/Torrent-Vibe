import UIKit

enum AppearanceMode: String, CaseIterable, Identifiable {
  case system
  case light
  case dark

  var id: Self { self }

  var label: String {
    switch self {
    case .system: "跟随系统"
    case .light: "浅色"
    case .dark: "深色"
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
