import Foundation
import XCTest

@testable import Torrent_Vibe

final class HelperServiceTests: XCTestCase {
  override func tearDown() {
    StubURLProtocol.handler = nil
    super.tearDown()
  }

  func testV2PairStatusAndUnpairContract() async throws {
    StubURLProtocol.handler = { request in
      let path = request.url?.path
      switch path {
      case "/discover":
        return Self.response(
          request,
          status: 200,
          json: [
            "version": "2.1.0",
            "clientCount": 3,
            "requiresPairingCode": true,
          ]
        )
      case "/pair":
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(json["code"], "ABC234")
        XCTAssertEqual(json["clientId"], "ios-client")
        XCTAssertEqual(json["clientName"], "Torrent Vibe iOS")
        return Self.response(
          request,
          status: 200,
          json: ["clientId": "ios-client", "token": "token-value"]
        )
      case "/status":
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token-value")
        return Self.response(
          request,
          status: 200,
          json: [
            "replicas": [
              [
                "id": "sub-1",
                "bangumiId": "4101",
                "title": "夏日观测站",
                "subgroupId": "583",
                "subgroupName": "ANi",
                "rssUrl": "https://mikan.test/RSS/Bangumi?bangumiId=4101&subgroupid=583",
                "episodes": [
                  ["episodeId": "ep-1", "title": "Episode 1", "state": "done"],
                  ["episodeId": "ep-2", "title": "Episode 2", "state": "downloading"],
                ],
              ],
              [
                "id": "sub-2",
                "bangumiId": "4102",
                "title": "星海列车",
                "subgroupId": "370",
                "subgroupName": "LoliHouse",
                "rssUrl": "https://mikan.test/RSS/Bangumi?bangumiId=4102&subgroupid=370",
                "episodes": [],
              ],
            ],
            "jobs": [
              [
                "bangumiId": "4103",
                "subgroupId": "583",
                "episodes": [
                  ["episodeId": "ep-3", "title": "Episode 3", "state": "needs-manual"]
                ],
              ]
            ],
          ]
        )
      case "/unpair":
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token-value")
        return Self.response(request, status: 200, json: ["ok": true])
      default:
        XCTFail("Unexpected Helper path: \(path ?? "nil")")
        return Self.response(request, status: 404, json: ["error": "not found"])
      }
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    let discovery = try await service.discover(at: baseURL)
    XCTAssertEqual(discovery.version, "2.1.0")
    XCTAssertEqual(discovery.clientCount, 3)

    let credential = try await service.pair(
      at: baseURL,
      code: "ABC234",
      clientID: "ios-client",
      clientName: "Torrent Vibe iOS"
    )
    XCTAssertEqual(credential.clientID, "ios-client")
    XCTAssertEqual(credential.token, "token-value")

    let status = try await service.status(at: baseURL, token: credential.token)
    XCTAssertEqual(status.version, "2.1.0")
    XCTAssertEqual(status.clientCount, 3)
    XCTAssertEqual(status.subscriptionCount, 2)
    XCTAssertEqual(status.pendingItems, 2)

    try await service.unpair(at: baseURL, token: credential.token)
  }

  func testSubscriptionBackfillAndRetryContract() async throws {
    StubURLProtocol.handler = { request in
      switch (request.httpMethod, request.url?.path) {
      case ("GET", "/subscriptions"):
        return Self.response(request, status: 200, json: ["revision": 7, "replicas": []])
      case ("PUT", "/subscriptions"):
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token-value")
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["revision"] as? Int, 7)
        XCTAssertEqual(
          (json["replicas"] as? [[String: Any]])?.first?["id"] as? String, "mikan:4101:583")
        return Self.response(
          request,
          status: 200,
          json: [
            "revision": 8,
            "replicas": [
              [
                "id": "mikan:4101:583",
                "bangumiId": "4101",
                "title": "夏日观测站",
                "subgroupId": "583",
                "subgroupName": "ANi",
                "rssUrl": "https://mikan.test/RSS/Bangumi?bangumiId=4101&subgroupid=583",
              ]
            ],
          ]
        )
      case ("POST", "/backfill"):
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["bangumiId"] as? String, "4101")
        XCTAssertEqual((json["episodes"] as? [[String: Any]])?.count, 1)
        return Self.response(
          request,
          status: 200,
          json: ["episodes": [["episodeId": "ep-1", "title": "Episode 1", "state": "pending"]]]
        )
      case ("POST", "/retry"):
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["episodeId"] as? String, "ep-1")
        return Self.response(
          request,
          status: 200,
          json: ["episodes": [["episodeId": "ep-1", "title": "Episode 1", "state": "pending"]]]
        )
      default:
        XCTFail(
          "Unexpected Helper request: \(request.httpMethod ?? "nil") \(request.url?.path ?? "nil")")
        return Self.response(request, status: 404, json: ["error": "not found"])
      }
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    let current = try await service.subscriptions(at: baseURL, token: "token-value")
    XCTAssertEqual(current.revision, 7)

    let desired = HelperReplica(
      id: "mikan:4101:583",
      bangumiId: "4101",
      title: "夏日观测站",
      bangumiSubjectId: nil,
      subgroupId: "583",
      subgroupName: "ANi",
      rssUrl: "https://mikan.test/RSS/Bangumi?bangumiId=4101&subgroupid=583"
    )
    let saved = try await service.replaceSubscriptions(
      at: baseURL,
      token: "token-value",
      revision: current.revision,
      replicas: [desired]
    )
    XCTAssertEqual(saved.revision, 8)
    XCTAssertEqual(saved.replicas, [desired])

    let imported = try await service.backfill(
      at: baseURL,
      token: "token-value",
      bangumiID: "4101",
      subgroupID: "583",
      episodes: [
        HelperBackfillEpisode(
          episodeId: "ep-1",
          title: "Episode 1",
          torrentUrl: "https://mikan.test/episode-1.torrent",
          publishedAt: nil,
          sizeBytes: nil
        )
      ]
    )
    XCTAssertEqual(imported.episodes.first?.state, .pending)

    let retried = try await service.retry(
      at: baseURL,
      token: "token-value",
      request: HelperRetryRequest(
        bangumiId: "4101",
        subgroupId: "583",
        episodeId: "ep-1",
        title: "Episode 1",
        torrentUrl: nil
      )
    )
    XCTAssertEqual(retried.episodes.first?.state, .pending)
  }

  func testRevisionConflictIncludesLatestSnapshot() async throws {
    StubURLProtocol.handler = { request in
      Self.response(
        request,
        status: 409,
        json: [
          "error": "revision conflict",
          "revision": 9,
          "replicas": [
            [
              "id": "remote",
              "bangumiId": "4102",
              "title": "星海列车",
              "subgroupId": "583",
              "subgroupName": "ANi",
              "rssUrl": "https://mikan.test/rss",
            ]
          ],
        ]
      )
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    do {
      _ = try await service.replaceSubscriptions(
        at: baseURL,
        token: "token-value",
        revision: 8,
        replicas: []
      )
      XCTFail("Expected revision conflict")
    } catch HelperServiceError.revisionConflict(let latest) {
      XCTAssertEqual(latest.revision, 9)
      XCTAssertEqual(latest.replicas.map(\.id), ["remote"])
    }
  }

  func testProfileGetAndSelectivePatchContract() async throws {
    StubURLProtocol.handler = { request in
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token-value")
      switch (request.httpMethod, request.url?.path) {
      case ("GET", "/profile"):
        return Self.response(
          request,
          status: 200,
          json: [
            "revision": 4,
            "records": [
              [
                "key": "ai.openai.apiKey",
                "value": "remote-openai-key",
                "secret": true,
                "updatedAt": "2026-08-19T12:00:00Z",
                "updatedBy": "desktop-client",
              ]
            ],
          ]
        )
      case ("PATCH", "/profile"):
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["revision"] as? Int, 4)
        let mutations = try XCTUnwrap(json["mutations"] as? [[String: Any]])
        XCTAssertEqual(mutations.count, 1)
        XCTAssertEqual(mutations[0]["operation"] as? String, "set")
        XCTAssertEqual(mutations[0]["key"] as? String, "discover.mteam.apiKey")
        XCTAssertEqual(mutations[0]["value"] as? String, "ios-mteam-key")
        XCTAssertEqual(mutations[0]["secret"] as? Bool, true)
        return Self.response(
          request,
          status: 200,
          json: [
            "revision": 5,
            "records": [
              [
                "key": "ai.openai.apiKey",
                "value": "remote-openai-key",
                "secret": true,
                "updatedAt": "2026-08-19T12:00:00Z",
                "updatedBy": "desktop-client",
              ],
              [
                "key": "discover.mteam.apiKey",
                "value": "ios-mteam-key",
                "secret": true,
                "updatedAt": "2026-08-19T12:01:00Z",
                "updatedBy": "ios-client",
              ],
            ],
          ]
        )
      default:
        XCTFail(
          "Unexpected Helper request: \(request.httpMethod ?? "nil") \(request.url?.path ?? "nil")")
        return Self.response(request, status: 404, json: ["error": "not found"])
      }
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    let current = try await service.profile(at: baseURL, token: "token-value")
    XCTAssertEqual(current.revision, 4)
    XCTAssertEqual(current.records.map(\.key), ["ai.openai.apiKey"])
    XCTAssertTrue(try XCTUnwrap(current.records.first).secret)

    let updated = try await service.updateProfile(
      at: baseURL,
      token: "token-value",
      revision: current.revision,
      mutations: [
        .set(key: "discover.mteam.apiKey", value: "ios-mteam-key", secret: true)
      ]
    )
    XCTAssertEqual(updated.revision, 5)
    XCTAssertEqual(
      Set(updated.records.map(\.key)),
      Set(["ai.openai.apiKey", "discover.mteam.apiKey"])
    )
  }

  func testProfileRevisionConflictIncludesLatestRecords() async throws {
    StubURLProtocol.handler = { request in
      Self.response(
        request,
        status: 409,
        json: [
          "error": "revision conflict",
          "revision": 8,
          "records": [
            [
              "key": "ai.openrouter.apiKey",
              "value": "latest-key",
              "secret": true,
              "updatedAt": "2026-08-19T12:00:00Z",
              "updatedBy": "desktop-client",
            ]
          ],
        ]
      )
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    do {
      _ = try await service.updateProfile(
        at: baseURL,
        token: "token-value",
        revision: 7,
        mutations: [.set(key: "discover.mteam.enabled", value: "true", secret: false)]
      )
      XCTFail("Expected profile revision conflict")
    } catch HelperServiceError.profileRevisionConflict(let latest) {
      XCTAssertEqual(latest.revision, 8)
      XCTAssertEqual(latest.records.map(\.key), ["ai.openrouter.apiKey"])
    }
  }

  func testOrganizeAndConfigContract() async throws {
    StubURLProtocol.handler = { request in
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token-value")
      switch (request.httpMethod, request.url?.path) {
      case ("GET", "/config"):
        return Self.response(
          request,
          status: 200,
          json: [
            "libraryRoot": "/tv",
            "organizeOnComplete": false,
            "hasTmdbApiKey": true,
          ]
        )
      case ("PUT", "/config"):
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["organizeOnComplete"] as? Bool, true)
        return Self.response(
          request,
          status: 200,
          json: [
            "libraryRoot": "/tv",
            "organizeOnComplete": true,
            "hasTmdbApiKey": true,
          ]
        )
      case ("POST", "/organize"):
        let body = try XCTUnwrap(Self.requestBody(request))
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["hash"] as? String, "abc")
        return Self.response(
          request,
          status: 200,
          json: [
            "hash": "abc",
            "status": "ok",
            "libraryRelPath": "Movies/Title (1999)/Title (1999).mkv",
            "dest": "/tv/Movies/Title (1999)/Title (1999).mkv",
          ]
        )
      default:
        XCTFail(
          "Unexpected Helper request: \(request.httpMethod ?? "nil") \(request.url?.path ?? "nil")")
        return Self.response(request, status: 404, json: ["error": "not found"])
      }
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    let current = try await service.config(at: baseURL, token: "token-value")
    XCTAssertFalse(current.organizeOnComplete)
    XCTAssertTrue(current.hasTmdbApiKey)

    let updated = try await service.updateConfig(
      at: baseURL,
      token: "token-value",
      organizeOnComplete: true
    )
    XCTAssertTrue(updated.organizeOnComplete)

    let organized = try await service.organize(at: baseURL, token: "token-value", hash: "abc")
    XCTAssertEqual(organized.status, "ok")
    XCTAssertEqual(organized.libraryRelPath, "Movies/Title (1999)/Title (1999).mkv")
  }

  func testDemoProfilePatchPreservesUnselectedAIRecords() async throws {
    let service = DemoHelperService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    let current = try await service.profile(at: baseURL, token: "token-value")

    let updated = try await service.updateProfile(
      at: baseURL,
      token: "token-value",
      revision: current.revision,
      mutations: [
        .set(
          key: "discover.mteam.baseUrl",
          value: "https://m-team.example.test/api",
          secret: false
        )
      ]
    )

    XCTAssertEqual(updated.revision, current.revision + 1)
    XCTAssertEqual(
      updated.records.first { $0.key == "ai.openai.apiKey" }?.value,
      "demo-openai-key"
    )
    XCTAssertEqual(
      updated.records.first { $0.key == "discover.mteam.baseUrl" }?.value,
      "https://m-team.example.test/api"
    )
  }

  func testCoordinatorMergesLatestRemoteSnapshotAfterConflict() async throws {
    let service = DemoHelperService()
    let coordinator = HelperSubscriptionCoordinator(service: service)
    let proposed = HelperReplica(
      id: "mikan:4101:583",
      bangumiId: "4101",
      title: "夏日观测站",
      bangumiSubjectId: "500001",
      subgroupId: "583",
      subgroupName: "ANi",
      rssUrl: "https://mikan.test/rss"
    )
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))

    let mutation = try await coordinator.upsert(
      proposed,
      at: baseURL,
      token: "token-value"
    )

    XCTAssertTrue(mutation.mergedConflict)
    XCTAssertEqual(mutation.snapshot.revision, 6)
    XCTAssertEqual(
      Set(mutation.snapshot.replicas.map(\.title)),
      Set(["星海列车", "雨后通信", "夏日观测站"])
    )
  }

  @MainActor
  func testEditingTargetsKeepsOneLogicalSubscriptionAcrossHelpers() async throws {
    let suiteName = "HelperServiceTests.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let credentialStore = InMemoryHelperCredentialStore()
    let service = DemoHelperService()
    let model = AppModel(
      launchArguments: ["tests", "-ui-demo", "-ui-helper-demo-paired"],
      defaults: defaults,
      helperCredentialStore: credentialStore,
      helperService: service,
      torrentRepository: DemoTorrentRepository()
    )

    await model.refreshAllHelperSubscriptions()
    let initial = try XCTUnwrap(model.helperSubscriptionGroups.first)
    XCTAssertEqual(model.helperSubscriptionGroups.count, 1)
    XCTAssertEqual(initial.replica.title, "星海列车")
    XCTAssertEqual(initial.targets.map(\.serverName), ["家庭 NAS"])

    let allTargetIDs = Set(model.pairedHelperServers.map(\.id))
    let outcome = try await model.updateMikanSubscriptionTargets(
      group: initial,
      targetServerIDs: allTargetIDs
    )

    XCTAssertEqual(outcome.serverNames, ["家庭 NAS", "书房 Mac"])
    XCTAssertFalse(outcome.mergedConflict)
    XCTAssertEqual(model.helperSubscriptionGroups.count, 1)
    let updated = try XCTUnwrap(model.helperSubscriptionGroups.first)
    XCTAssertEqual(Set(updated.targets.map(\.serverName)), Set(["家庭 NAS", "书房 Mac"]))
  }

  func testUnauthorizedStatusMapsToExpiredCredential() async throws {
    StubURLProtocol.handler = { request in
      if request.url?.path == "/discover" {
        return Self.response(
          request,
          status: 200,
          json: [
            "version": "2.1.0",
            "clientCount": 1,
            "requiresPairingCode": true,
          ]
        )
      }
      return Self.response(request, status: 401, json: ["error": "unauthorized"])
    }

    let service = makeService()
    let baseURL = try XCTUnwrap(URL(string: "http://helper.test:17890"))
    do {
      _ = try await service.status(at: baseURL, token: "expired")
      XCTFail("Expected unauthorized error")
    } catch {
      XCTAssertEqual(error as? HelperServiceError, .unauthorized)
    }
  }

  private func makeService() -> URLSessionHelperService {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [StubURLProtocol.self]
    return URLSessionHelperService(session: URLSession(configuration: configuration))
  }

  private static func response(
    _ request: URLRequest,
    status: Int,
    json: Any
  ) -> (HTTPURLResponse, Data) {
    let response = HTTPURLResponse(
      url: request.url!,
      statusCode: status,
      httpVersion: nil,
      headerFields: ["Content-Type": "application/json"]
    )!
    let data = try! JSONSerialization.data(withJSONObject: json)
    return (response, data)
  }

  private static func requestBody(_ request: URLRequest) -> Data? {
    if let body = request.httpBody {
      return body
    }
    guard let stream = request.httpBodyStream else { return nil }
    stream.open()
    defer { stream.close() }
    var result = Data()
    var buffer = [UInt8](repeating: 0, count: 1_024)
    while stream.hasBytesAvailable {
      let count = stream.read(&buffer, maxLength: buffer.count)
      guard count > 0 else { break }
      result.append(buffer, count: count)
    }
    return result
  }
}

final class TorrentRepositoryTests: XCTestCase {
  func testDemoRepositoryPersistsPauseAndResumeState() async throws {
    let repository = DemoTorrentRepository()
    let server = ServerConfiguration(
      name: "Demo",
      baseURL: try XCTUnwrap(URL(string: "https://demo.example.test")),
      username: "demo"
    )

    let initial = try await repository.snapshot(for: server)
    let torrent = try XCTUnwrap(initial.torrents.first)
    XCTAssertEqual(torrent.status, .downloading)

    try await repository.setPaused(true, torrentIDs: [torrent.id], on: server)
    let paused = try await repository.snapshot(for: server)
    XCTAssertEqual(paused.torrents.first?.status, .paused)
    XCTAssertEqual(paused.torrents.first?.eta, "已暂停")

    try await repository.setPaused(false, torrentIDs: [torrent.id], on: server)
    let resumed = try await repository.snapshot(for: server)
    XCTAssertEqual(resumed.torrents.first?.status, .downloading)
    XCTAssertEqual(resumed.torrents.first?.downloadSpeed, "18.4 MB/s")
  }

  func testDemoRepositorySupportsAdvancedImportManagementAndDeletion() async throws {
    let repository = DemoTorrentRepository()
    let server = ServerConfiguration(
      name: "Demo",
      baseURL: try XCTUnwrap(URL(string: "https://demo.example.test")),
      username: "demo"
    )

    try await repository.addTorrent(
      TorrentAddRequest(
        source: .file(name: "release.torrent", data: Data("torrent".utf8)),
        savePath: "/Media/Incoming",
        category: "review",
        tags: ["iOS", "TestFlight"],
        downloadLimit: 2 * 1_048_576,
        uploadLimit: 1_048_576
      ),
      to: server
    )

    var snapshot = try await repository.snapshot(for: server)
    let imported = try XCTUnwrap(snapshot.torrents.first)
    XCTAssertEqual(imported.name, "release")
    XCTAssertEqual(imported.savePath, "/Media/Incoming")
    XCTAssertEqual(imported.category, "review")
    XCTAssertEqual(imported.tags, ["iOS", "TestFlight"])
    XCTAssertEqual(imported.downloadLimit, 2 * 1_048_576)
    XCTAssertEqual(imported.uploadLimit, 1_048_576)

    try await repository.updateTorrents(
      ids: [imported.id],
      request: TorrentManagementRequest(
        category: "verified",
        tags: ["mobile"],
        downloadLimit: 0,
        uploadLimit: 512 * 1_024
      ),
      on: server
    )
    snapshot = try await repository.snapshot(for: server)
    let updated = try XCTUnwrap(snapshot.torrents.first { $0.id == imported.id })
    XCTAssertEqual(updated.category, "verified")
    XCTAssertEqual(updated.tags, ["mobile"])
    XCTAssertEqual(updated.downloadLimit, 0)
    XCTAssertEqual(updated.uploadLimit, 512 * 1_024)

    try await repository.deleteTorrents(
      ids: [imported.id],
      deleteFiles: false,
      on: server
    )
    snapshot = try await repository.snapshot(for: server)
    XCTAssertFalse(snapshot.torrents.contains { $0.id == imported.id })
  }

  func testDemoRepositoryProvidesInspectableTorrentContent() async throws {
    let repository = DemoTorrentRepository()
    let server = ServerConfiguration(
      name: "Demo",
      baseURL: try XCTUnwrap(URL(string: "https://demo.example.test")),
      username: "demo"
    )
    let snapshot = try await repository.snapshot(for: server)
    let torrent = try XCTUnwrap(snapshot.torrents.first)

    let files = try await repository.files(for: torrent.id, on: server)
    XCTAssertEqual(files.count, 3)
    XCTAssertEqual(files.first?.displayName, "Blue.Planet.II.S01E01.2160p.mkv")
    XCTAssertEqual(files.last?.priorityTitle, "高")

    let trackers = try await repository.trackers(for: torrent.id, on: server)
    XCTAssertEqual(trackers.first?.statusTitle, "工作中")
    XCTAssertEqual(trackers.first?.seedCount, 31)

    let peers = try await repository.peers(for: torrent.id, on: server)
    XCTAssertEqual(peers.count, 3)
    XCTAssertTrue(peers.contains { $0.endpoint == "[2001:db8::23]:51413" })
    XCTAssertTrue(peers.allSatisfy { $0.country == "测试网络" })
  }

  func testDemoRepositoryPersistsTorrentDownloadStrategies() async throws {
    let repository = DemoTorrentRepository()
    let server = ServerConfiguration(
      name: "Demo",
      baseURL: try XCTUnwrap(URL(string: "https://demo.example.test")),
      username: "demo"
    )
    let initial = try await repository.snapshot(for: server)
    let torrent = try XCTUnwrap(initial.torrents.first)
    XCTAssertTrue(torrent.isSequentialDownloadEnabled)
    XCTAssertFalse(torrent.isFirstLastPiecePriorityEnabled)

    try await repository.toggleDownloadStrategy(
      .sequential,
      torrentIDs: [torrent.id],
      on: server
    )
    try await repository.toggleDownloadStrategy(
      .firstLastPiecePriority,
      torrentIDs: [torrent.id],
      on: server
    )

    let updatedSnapshot = try await repository.snapshot(for: server)
    let updated = try XCTUnwrap(updatedSnapshot.torrents.first)
    XCTAssertFalse(updated.isSequentialDownloadEnabled)
    XCTAssertTrue(updated.isFirstLastPiecePriorityEnabled)
  }

  func testQBittorrentRepositoryDecodesDownloadStrategiesFromSnapshot() async throws {
    StubURLProtocol.handler = { request in
      let path = request.url?.path ?? ""
      let body: Data
      if path.hasSuffix("/auth/login") {
        body = Data("Ok.".utf8)
      } else if path.hasSuffix("/torrents/info") {
        body = Data(
          """
          [{"hash":"strategy-hash","name":"Strategy Demo","progress":0.5,"size":1048576,"dlspeed":1024,"upspeed":0,"eta":60,"state":"downloading","seq_dl":true,"f_l_piece_prio":false}]
          """.utf8
        )
      } else if path.hasSuffix("/transfer/info") {
        body = Data("{\"dl_info_speed\":1024,\"up_info_speed\":0}".utf8)
      } else if path.hasSuffix("/app/version") {
        body = Data("v5.1.2".utf8)
      } else {
        throw URLError(.badServerResponse)
      }
      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 200,
        httpVersion: nil,
        headerFields: ["Content-Type": "application/json"]
      )!
      return (response, body)
    }
    defer { StubURLProtocol.handler = nil }

    let credentials = TorrentTestCredentialStore()
    let server = ServerConfiguration(
      name: "NAS",
      baseURL: try XCTUnwrap(URL(string: "https://nas.example.test:8080")),
      username: "admin"
    )
    try credentials.setPassword("secret", for: server.id)
    let repository = QBittorrentTorrentRepository(
      credentialStore: credentials,
      sessionFactory: {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
      }
    )

    let snapshot = try await repository.snapshot(for: server)
    let torrent = try XCTUnwrap(snapshot.torrents.first)
    XCTAssertTrue(torrent.isSequentialDownloadEnabled)
    XCTAssertFalse(torrent.isFirstLastPiecePriorityEnabled)
  }

  func testQBittorrentRepositorySendsFileOptionsAndSafeManagementRequests() async throws {
    let recorder = TorrentRequestRecorder()
    StubURLProtocol.handler = { request in
      recorder.append(request)
      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 200,
        httpVersion: nil,
        headerFields: ["Content-Type": "text/plain"]
      )!
      let data =
        request.url?.path.hasSuffix("/auth/login") == true
        ? Data("Ok.".utf8) : Data("Ok.".utf8)
      return (response, data)
    }
    defer { StubURLProtocol.handler = nil }

    let credentials = TorrentTestCredentialStore()
    let server = ServerConfiguration(
      name: "NAS",
      baseURL: try XCTUnwrap(URL(string: "https://nas.example.test:8080")),
      username: "admin"
    )
    try credentials.setPassword("secret", for: server.id)
    let repository = QBittorrentTorrentRepository(
      credentialStore: credentials,
      sessionFactory: {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
      }
    )

    try await repository.addTorrent(
      TorrentAddRequest(
        source: .file(name: "release.torrent", data: Data("torrent-data".utf8)),
        savePath: "/Media/Incoming",
        category: "review",
        tags: ["iOS", "TestFlight"],
        downloadLimit: 2_097_152,
        uploadLimit: 1_048_576
      ),
      to: server
    )
    let add = try XCTUnwrap(recorder.requests.first { $0.path.hasSuffix("/torrents/add") })
    XCTAssertTrue(add.contentType.hasPrefix("multipart/form-data; boundary="))
    XCTAssertTrue(add.body.contains("name=\"torrents\"; filename=\"release.torrent\""))
    XCTAssertTrue(add.body.contains("Content-Type: application/x-bittorrent"))
    XCTAssertTrue(add.body.contains("torrent-data"))
    XCTAssertTrue(add.body.contains("name=\"savepath\"\r\n\r\n/Media/Incoming"))
    XCTAssertTrue(add.body.contains("name=\"category\"\r\n\r\nreview"))
    XCTAssertTrue(add.body.contains("name=\"tags\"\r\n\r\niOS,TestFlight"))
    XCTAssertTrue(add.body.contains("name=\"dlLimit\"\r\n\r\n2097152"))
    XCTAssertTrue(add.body.contains("name=\"upLimit\"\r\n\r\n1048576"))

    try await repository.deleteTorrents(
      ids: ["aaa", "bbb"],
      deleteFiles: false,
      on: server
    )
    let delete = try XCTUnwrap(recorder.requests.last { $0.path.hasSuffix("/torrents/delete") })
    XCTAssertTrue(delete.body.contains("hashes=aaa%7Cbbb"))
    XCTAssertTrue(delete.body.contains("deleteFiles=false"))

    try await repository.updateTorrents(
      ids: ["aaa", "bbb"],
      request: TorrentManagementRequest(
        category: "verified",
        tags: ["mobile"],
        downloadLimit: 0,
        uploadLimit: 524_288
      ),
      on: server
    )
    let paths = recorder.requests.map(\.path)
    XCTAssertTrue(paths.contains { $0.hasSuffix("/torrents/setCategory") })
    XCTAssertTrue(paths.contains { $0.hasSuffix("/torrents/removeTags") })
    XCTAssertTrue(paths.contains { $0.hasSuffix("/torrents/addTags") })
    XCTAssertTrue(paths.contains { $0.hasSuffix("/torrents/setDownloadLimit") })
    XCTAssertTrue(paths.contains { $0.hasSuffix("/torrents/setUploadLimit") })
    let uploadLimit = try XCTUnwrap(
      recorder.requests.last { $0.path.hasSuffix("/torrents/setUploadLimit") }
    )
    XCTAssertTrue(uploadLimit.body.contains("hashes=aaa%7Cbbb"))
    XCTAssertTrue(uploadLimit.body.contains("limit=524288"))

    try await repository.toggleDownloadStrategy(
      .sequential,
      torrentIDs: ["aaa", "bbb"],
      on: server
    )
    try await repository.toggleDownloadStrategy(
      .firstLastPiecePriority,
      torrentIDs: ["aaa", "bbb"],
      on: server
    )
    let sequential = try XCTUnwrap(
      recorder.requests.last { $0.path.hasSuffix("/torrents/toggleSequentialDownload") }
    )
    let firstLast = try XCTUnwrap(
      recorder.requests.last { $0.path.hasSuffix("/torrents/toggleFirstLastPiecePrio") }
    )
    XCTAssertTrue(sequential.body.contains("hashes=aaa%7Cbbb"))
    XCTAssertTrue(firstLast.body.contains("hashes=aaa%7Cbbb"))
  }

  func testQBittorrentRepositoryLoadsFilesTrackersAndPeersWithEncodedHash() async throws {
    let recorder = TorrentRequestRecorder()
    StubURLProtocol.handler = { request in
      recorder.append(request)
      let path = request.url?.path ?? ""
      let body: Data
      if path.hasSuffix("/auth/login") {
        body = Data("Ok.".utf8)
      } else if path.hasSuffix("/torrents/files") {
        body = Data(
          """
          [{"index":4,"name":"Season/Episode.mkv","size":1048576,"progress":0.75,"priority":6}]
          """.utf8
        )
      } else if path.hasSuffix("/torrents/trackers") {
        body = Data(
          """
          [{"url":"https://tracker.example/announce","status":2,"tier":0,"msg":"Working","num_peers":12,"num_seeds":8,"num_leeches":4,"num_downloaded":31}]
          """.utf8
        )
      } else if path.hasSuffix("/sync/torrentPeers") {
        body = Data(
          """
          {"rid":1,"full_update":true,"peers":{"203.0.113.9:6881":{"ip":"203.0.113.9","port":6881,"client":"qBittorrent 5.1","progress":0.6,"dl_speed":2048,"up_speed":1024,"connection":"BT","flags":"D E","flags_desc":"Downloading, encrypted","country":"Test"}}}
          """.utf8
        )
      } else {
        throw URLError(.badServerResponse)
      }
      let response = HTTPURLResponse(
        url: request.url!,
        statusCode: 200,
        httpVersion: nil,
        headerFields: ["Content-Type": "application/json"]
      )!
      return (response, body)
    }
    defer { StubURLProtocol.handler = nil }

    let credentials = TorrentTestCredentialStore()
    let server = ServerConfiguration(
      name: "NAS",
      baseURL: try XCTUnwrap(URL(string: "https://nas.example.test:8080")),
      username: "admin"
    )
    try credentials.setPassword("secret", for: server.id)
    let repository = QBittorrentTorrentRepository(
      credentialStore: credentials,
      sessionFactory: {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
      }
    )
    let torrentID = "hash with + reserved"

    let files = try await repository.files(for: torrentID, on: server)
    let trackers = try await repository.trackers(for: torrentID, on: server)
    let peers = try await repository.peers(for: torrentID, on: server)

    XCTAssertEqual(files.first?.id, 4)
    XCTAssertEqual(files.first?.progress, 0.75)
    XCTAssertEqual(trackers.first?.peerCount, 12)
    XCTAssertEqual(trackers.first?.message, "Working")
    XCTAssertEqual(peers.first?.client, "qBittorrent 5.1")
    XCTAssertEqual(peers.first?.downloadSpeed, 2_048)

    let contentRequests = recorder.requests.filter { !$0.path.hasSuffix("/auth/login") }
    XCTAssertEqual(contentRequests.count, 3)
    XCTAssertTrue(
      contentRequests.allSatisfy { request in
        var components = URLComponents()
        components.percentEncodedQuery = request.query
        return components.queryItems?.first(where: { $0.name == "hash" })?.value == torrentID
      })
    let peerRequest = try XCTUnwrap(
      contentRequests.first { $0.path.hasSuffix("/sync/torrentPeers") }
    )
    XCTAssertTrue(peerRequest.query.contains("rid=0"))
  }
}

private struct TorrentRecordedRequest: Sendable {
  let body: String
  let contentType: String
  let path: String
  let query: String
}

private final class TorrentRequestRecorder: @unchecked Sendable {
  private let lock = NSLock()
  private var storage: [TorrentRecordedRequest] = []

  var requests: [TorrentRecordedRequest] {
    lock.lock()
    defer { lock.unlock() }
    return storage
  }

  func append(_ request: URLRequest) {
    let recorded = TorrentRecordedRequest(
      body: String(decoding: requestBodyData(request), as: UTF8.self),
      contentType: request.value(forHTTPHeaderField: "Content-Type") ?? "",
      path: request.url?.path ?? "",
      query: request.url.flatMap {
        URLComponents(url: $0, resolvingAgainstBaseURL: false)?.percentEncodedQuery
      } ?? ""
    )
    lock.lock()
    storage.append(recorded)
    lock.unlock()
  }
}

private final class TorrentTestCredentialStore: ServerCredentialStore, @unchecked Sendable {
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

private func requestBodyData(_ request: URLRequest) -> Data {
  if let body = request.httpBody {
    return body
  }
  guard let stream = request.httpBodyStream else { return Data() }
  stream.open()
  defer { stream.close() }
  var result = Data()
  var buffer = [UInt8](repeating: 0, count: 1_024)
  while stream.hasBytesAvailable {
    let count = stream.read(&buffer, maxLength: buffer.count)
    guard count > 0 else { break }
    result.append(buffer, count: count)
  }
  return result
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

private final class StubURLProtocol: URLProtocol, @unchecked Sendable {
  nonisolated(unsafe) static var handler:
    (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

  override class func canInit(with request: URLRequest) -> Bool { true }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

  override func startLoading() {
    do {
      let handler = try XCTUnwrap(Self.handler)
      let (response, data) = try handler(request)
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}
}
