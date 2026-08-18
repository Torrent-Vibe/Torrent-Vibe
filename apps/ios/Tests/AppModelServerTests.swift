import Foundation
import XCTest

@testable import Torrent_Vibe

@MainActor
final class AppModelServerTests: XCTestCase {
  func testUpdateServerChangesConfigurationAndKeepsPasswordWhenBlank() throws {
    let env = try makeEnvironment()
    defer { env.tearDown() }

    try env.model.addServer(
      name: "NAS",
      baseURLText: "http://192.168.1.10:8080",
      username: "admin",
      password: "secret",
      helperURLText: "http://192.168.1.10:17890"
    )
    let id = try XCTUnwrap(env.model.servers.first?.id)
    try env.helperTokens.setToken("paired-token", for: id)

    try env.model.updateServer(
      id: id,
      name: "书房 NAS",
      baseURLText: "http://192.168.1.11:8080",
      username: "root",
      password: "",
      helperURLText: "http://192.168.1.11:17890"
    )

    let server = try XCTUnwrap(env.model.servers.first)
    XCTAssertEqual(server.name, "书房 NAS")
    XCTAssertEqual(server.baseURL.absoluteString, "http://192.168.1.11:8080")
    XCTAssertEqual(server.username, "root")
    XCTAssertEqual(server.helperBaseURL?.absoluteString, "http://192.168.1.11:17890")
    XCTAssertEqual(try env.passwords.password(for: id), "secret")
    XCTAssertNil(try env.helperTokens.token(for: id))
    XCTAssertFalse(env.model.hasStoredHelperToken(for: id))
  }

  func testUpdateServerReplacesPasswordAndPreservesHelperWhenURLUnchanged() throws {
    let env = try makeEnvironment()
    defer { env.tearDown() }

    try env.model.addServer(
      name: "NAS",
      baseURLText: "http://192.168.1.10:8080",
      username: "admin",
      password: "secret",
      helperURLText: "http://192.168.1.10:17890"
    )
    let id = try XCTUnwrap(env.model.servers.first?.id)
    try env.helperTokens.setToken("paired-token", for: id)

    try env.model.updateServer(
      id: id,
      name: "NAS",
      baseURLText: "http://192.168.1.10:8080",
      username: "admin",
      password: "new-secret",
      helperURLText: "http://192.168.1.10:17890"
    )

    XCTAssertEqual(try env.passwords.password(for: id), "new-secret")
    XCTAssertEqual(try env.helperTokens.token(for: id), "paired-token")
    XCTAssertTrue(env.model.hasStoredHelperToken(for: id))
  }

  func testUpdatedServerPersistsAcrossRelaunch() throws {
    let env = try makeEnvironment()
    defer { env.tearDown() }

    try env.model.addServer(
      name: "NAS",
      baseURLText: "http://192.168.1.10:8080",
      username: "admin",
      password: "secret",
      helperURLText: ""
    )
    let id = try XCTUnwrap(env.model.servers.first?.id)

    try env.model.updateServer(
      id: id,
      name: "书房 NAS",
      baseURLText: "https://nas.local:8080",
      username: "root",
      password: "",
      helperURLText: "http://nas.local:17890"
    )

    let reloaded = AppModel(
      launchArguments: ["tests"],
      defaults: env.defaults,
      credentialStore: env.passwords,
      helperCredentialStore: env.helperTokens,
      helperService: DemoHelperService(),
      torrentRepository: DemoTorrentRepository()
    )
    let server = try XCTUnwrap(reloaded.servers.first)
    XCTAssertEqual(server.id, id)
    XCTAssertEqual(server.name, "书房 NAS")
    XCTAssertEqual(server.baseURL.absoluteString, "https://nas.local:8080")
    XCTAssertEqual(server.username, "root")
    XCTAssertEqual(server.helperBaseURL?.absoluteString, "http://nas.local:17890")
  }

  func testUpdateServerRejectsMissingServer() {
    let env: TestEnvironment
    do {
      env = try makeEnvironment()
    } catch {
      return XCTFail("Failed to create test environment: \(error)")
    }
    defer { env.tearDown() }

    XCTAssertThrowsError(
      try env.model.updateServer(
        id: UUID(),
        name: "NAS",
        baseURLText: "http://192.168.1.10:8080",
        username: "admin",
        password: "secret",
        helperURLText: ""
      )
    ) { error in
      XCTAssertEqual(error as? ServerValidationError, .serverUnavailable)
    }
  }

  private func makeEnvironment() throws -> TestEnvironment {
    let suiteName = "AppModelServerTests.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    let passwords = InMemoryServerCredentialStore()
    let helperTokens = InMemoryHelperCredentialStore()
    let model = AppModel(
      launchArguments: ["tests"],
      defaults: defaults,
      credentialStore: passwords,
      helperCredentialStore: helperTokens,
      helperService: DemoHelperService(),
      torrentRepository: DemoTorrentRepository()
    )
    return TestEnvironment(
      suiteName: suiteName,
      defaults: defaults,
      passwords: passwords,
      helperTokens: helperTokens,
      model: model
    )
  }
}

private struct TestEnvironment {
  let suiteName: String
  let defaults: UserDefaults
  let passwords: InMemoryServerCredentialStore
  let helperTokens: InMemoryHelperCredentialStore
  let model: AppModel

  func tearDown() {
    defaults.removePersistentDomain(forName: suiteName)
  }
}

private final class InMemoryServerCredentialStore: ServerCredentialStore, @unchecked Sendable {
  private let lock = NSLock()
  private var passwords: [UUID: String] = [:]

  func deletePassword(for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    passwords[serverID] = nil
  }

  func setPassword(_ password: String, for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    passwords[serverID] = password
  }

  func password(for serverID: UUID) throws -> String? {
    lock.lock()
    defer { lock.unlock() }
    return passwords[serverID]
  }
}

private final class InMemoryHelperCredentialStore: HelperCredentialStore, @unchecked Sendable {
  private let lock = NSLock()
  private var tokens: [UUID: String] = [:]

  func deleteToken(for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    tokens[serverID] = nil
  }

  func setToken(_ token: String, for serverID: UUID) throws {
    lock.lock()
    defer { lock.unlock() }
    tokens[serverID] = token
  }

  func token(for serverID: UUID) throws -> String? {
    lock.lock()
    defer { lock.unlock() }
    return tokens[serverID]
  }
}
