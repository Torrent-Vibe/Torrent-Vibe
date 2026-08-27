import Foundation
import Security

protocol ServerCredentialStore: Sendable {
  func deletePassword(for serverID: UUID) throws
  func password(for serverID: UUID) throws -> String?
  func setPassword(_ password: String, for serverID: UUID) throws
}

struct KeychainServerCredentialStore: ServerCredentialStore {
  private let service = "dev.innei.torrent-vibe.qbittorrent"

  func password(for serverID: UUID) throws -> String? {
    var query = baseQuery(for: serverID)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = result as? Data else {
      throw KeychainCredentialError.unexpectedStatus(status)
    }
    guard let password = String(data: data, encoding: .utf8) else {
      throw KeychainCredentialError.invalidPasswordData
    }
    return password
  }

  func setPassword(_ password: String, for serverID: UUID) throws {
    let data = Data(password.utf8)
    let query = baseQuery(for: serverID)
    let attributes = [kSecValueData as String: data]
    let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)

    if updateStatus == errSecItemNotFound {
      var newItem = query
      newItem[kSecValueData as String] = data
      newItem[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      let addStatus = SecItemAdd(newItem as CFDictionary, nil)
      guard addStatus == errSecSuccess else {
        throw KeychainCredentialError.unexpectedStatus(addStatus)
      }
      return
    }

    guard updateStatus == errSecSuccess else {
      throw KeychainCredentialError.unexpectedStatus(updateStatus)
    }
  }

  func deletePassword(for serverID: UUID) throws {
    let status = SecItemDelete(baseQuery(for: serverID) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw KeychainCredentialError.unexpectedStatus(status)
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

enum KeychainCredentialError: LocalizedError {
  case invalidPasswordData
  case unexpectedStatus(OSStatus)

  var errorDescription: String? {
    switch self {
    case .invalidPasswordData:
      String(localized: "Keychain 中的密码数据无法读取。")
    case .unexpectedStatus(let status):
      if let message = SecCopyErrorMessageString(status, nil) as String? {
        String(localized: "Keychain 操作失败：\(message)")
      } else {
        String(localized: "Keychain 操作失败（\(status)）。")
      }
    }
  }
}
