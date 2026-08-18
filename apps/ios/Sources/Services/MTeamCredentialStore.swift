import Foundation
import Security

protocol MTeamCredentialStore: Sendable {
  func apiKey() throws -> String?
  func deleteAPIKey() throws
  func setAPIKey(_ apiKey: String) throws
}

struct KeychainMTeamCredentialStore: MTeamCredentialStore {
  private let account = "api-key"
  private let service = "dev.innei.torrent-vibe.mteam"

  func apiKey() throws -> String? {
    var query = baseQuery
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
    guard let apiKey = String(data: data, encoding: .utf8) else {
      throw KeychainCredentialError.invalidPasswordData
    }
    return apiKey
  }

  func setAPIKey(_ apiKey: String) throws {
    let value = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else {
      try deleteAPIKey()
      return
    }

    let data = Data(value.utf8)
    let attributes = [kSecValueData as String: data]
    let updateStatus = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)

    if updateStatus == errSecItemNotFound {
      var item = baseQuery
      item[kSecValueData as String] = data
      item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      let addStatus = SecItemAdd(item as CFDictionary, nil)
      guard addStatus == errSecSuccess else {
        throw KeychainCredentialError.unexpectedStatus(addStatus)
      }
      return
    }

    guard updateStatus == errSecSuccess else {
      throw KeychainCredentialError.unexpectedStatus(updateStatus)
    }
  }

  func deleteAPIKey() throws {
    let status = SecItemDelete(baseQuery as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw KeychainCredentialError.unexpectedStatus(status)
    }
  }

  private var baseQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }
}
