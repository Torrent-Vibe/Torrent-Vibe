import Foundation

enum HelperEventFieldValue: Sendable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case null
}

extension HelperEventFieldValue: Codable {
  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else {
      throw DecodingError.dataCorruptedError(
        in: container, debugDescription: "unsupported helper event field value")
    }
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .string(let value):
      try container.encode(value)
    case .number(let value):
      try container.encode(value)
    case .bool(let value):
      try container.encode(value)
    case .null:
      try container.encodeNil()
    }
  }
}

extension HelperEventFieldValue: Equatable, Hashable {}

extension HelperEventFieldValue {
  var displayText: String {
    switch self {
    case .string(let value): value
    case .number(let value): value.truncatingRemainder(dividingBy: 1) == 0
      ? String(Int64(value)) : String(value)
    case .bool(let value): value ? "true" : "false"
    case .null: "null"
    }
  }
}
