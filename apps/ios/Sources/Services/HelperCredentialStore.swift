import Foundation
import Security

protocol HelperCredentialStore: Sendable {
  func deleteToken(for serverID: UUID) throws
  func setToken(_ token: String, for serverID: UUID) throws
  func token(for serverID: UUID) throws -> String?
}

struct KeychainHelperCredentialStore: HelperCredentialStore {
  private let service = "dev.innei.torrent-vibe.helper"

  func token(for serverID: UUID) throws -> String? {
    var query = baseQuery(for: serverID)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = result as? Data else {
      throw HelperCredentialError.unexpectedStatus(status)
    }
    guard let token = String(data: data, encoding: .utf8) else {
      throw HelperCredentialError.invalidTokenData
    }
    return token
  }

  func setToken(_ token: String, for serverID: UUID) throws {
    let data = Data(token.utf8)
    let query = baseQuery(for: serverID)
    let attributes = [kSecValueData as String: data]
    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

    if updateStatus == errSecItemNotFound {
      var newItem = query
      newItem[kSecValueData as String] = data
      newItem[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      let addStatus = SecItemAdd(newItem as CFDictionary, nil)
      guard addStatus == errSecSuccess else {
        throw HelperCredentialError.unexpectedStatus(addStatus)
      }
      return
    }

    guard updateStatus == errSecSuccess else {
      throw HelperCredentialError.unexpectedStatus(updateStatus)
    }
  }

  func deleteToken(for serverID: UUID) throws {
    let status = SecItemDelete(baseQuery(for: serverID) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw HelperCredentialError.unexpectedStatus(status)
    }
  }

  private func baseQuery(for serverID: UUID) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: serverID.uuidString,
    ]
  }
}

enum HelperCredentialError: LocalizedError {
  case invalidTokenData
  case unexpectedStatus(OSStatus)

  var errorDescription: String? {
    switch self {
    case .invalidTokenData:
      "Keychain 中的 Helper 凭据无法读取。"
    case .unexpectedStatus(let status):
      if let message = SecCopyErrorMessageString(status, nil) as String? {
        "Helper Keychain 操作失败：\(message)"
      } else {
        "Helper Keychain 操作失败（\(status)）。"
      }
    }
  }
}
