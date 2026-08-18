import XCTest

@testable import Torrent_Vibe

@MainActor
final class IOSIntegrationsTests: XCTestCase {
  func testMTeamBatchImportDefersTokensAndRetriesOnlyFailures() async throws {
    let first = makeMTeamTorrent(id: "first", title: "First")
    let second = makeMTeamTorrent(id: "second", title: "Second")
    let service = BatchMTeamService(failingOnceFor: [second.id])
    let model = BatchTorrentAdder()
    let serverID = UUID()
    let configuration = try MTeamProviderConfiguration(
      baseURLText: "https://mteam.example.test/api",
      apiKey: "test-key",
      pageSize: 20
    )
    let coordinator = MTeamBatchImportCoordinator(
      torrents: [first, second],
      configuration: configuration,
      service: service,
      model: model,
      selectedServerID: serverID
    )

    var downloadCalls = await service.downloadCalls()
    XCTAssertEqual(downloadCalls, [])

    let firstCompletedCount = try await coordinator.importPending()

    XCTAssertEqual(firstCompletedCount, 1)
    XCTAssertEqual(coordinator.pendingTorrents.map(\.id), [second.id])
    downloadCalls = await service.downloadCalls()
    XCTAssertEqual(downloadCalls, [first.id, second.id])
    XCTAssertEqual(model.addedURLs, ["https://tracker.example.test/first.torrent"])

    let finalCompletedCount = try await coordinator.importPending()

    XCTAssertEqual(finalCompletedCount, 2)
    XCTAssertTrue(coordinator.pendingTorrents.isEmpty)
    downloadCalls = await service.downloadCalls()
    XCTAssertEqual(downloadCalls, [first.id, second.id, second.id])
    XCTAssertEqual(
      model.addedURLs,
      [
        "https://tracker.example.test/first.torrent",
        "https://tracker.example.test/second.torrent",
      ]
    )
  }

  func testCompletionDetectorEstablishesBaselineThenReportsOnlyTransitions() {
    let baseline = TorrentCompletionDetector.detect(
      torrents: [makeTorrent(id: "existing", status: .seeding)],
      previouslyCompletedIDs: nil
    )

    XCTAssertTrue(baseline.baselineEstablished)
    XCTAssertTrue(baseline.newlyCompleted.isEmpty)

    let transition = TorrentCompletionDetector.detect(
      torrents: [
        makeTorrent(id: "existing", status: .seeding),
        makeTorrent(id: "new", status: .completed),
        makeTorrent(id: "active", status: .downloading),
      ],
      previouslyCompletedIDs: baseline.storedIDs
    )

    XCTAssertFalse(transition.baselineEstablished)
    XCTAssertEqual(transition.newlyCompleted, [TorrentCompletion(id: "new", name: "new")])
    XCTAssertEqual(transition.storedIDs, ["existing", "new"])
  }

  func testShortcutRoutesKeepMagnetBehindImportConfirmation() throws {
    XCTAssertEqual(try TorrentShortcutRoute.parse(TorrentShortcutRoute.tasksURL), .tasks)
    XCTAssertEqual(
      try TorrentShortcutRoute.parse(TorrentShortcutRoute.refreshURL),
      .refreshTasks
    )

    let magnet = "magnet:?xt=urn:btih:0123456789ABCDEF&dn=Example"
    let route = try XCTUnwrap(
      TorrentShortcutRoute.parse(try TorrentShortcutRoute.magnetImportURL(magnet))
    )
    guard case .importMagnet(let payload) = route else {
      return XCTFail("Expected a Magnet import handoff")
    }
    XCTAssertEqual(payload.source, .link(magnet))
    XCTAssertThrowsError(try TorrentShortcutRoute.magnetImportURL("https://example.com/file"))
  }

  private func makeMTeamTorrent(id: String, title: String) -> MTeamTorrent {
    MTeamTorrent(
      category: nil,
      createdAt: nil,
      discount: nil,
      discountEndsAt: nil,
      doubanURL: nil,
      id: id,
      imdbURL: nil,
      leechers: nil,
      seeders: nil,
      sizeBytes: nil,
      snatches: nil,
      synopsis: nil,
      tags: [],
      title: title
    )
  }

  private func makeTorrent(id: String, status: TorrentStatus) -> TorrentSummary {
    TorrentSummary(
      id: id,
      name: id,
      progress: status == .downloading ? 0.5 : 1,
      size: "1 GB",
      downloadSpeed: "—",
      uploadSpeed: "—",
      eta: "—",
      status: status
    )
  }
}

private actor BatchMTeamService: MTeamService {
  private var calls: [String] = []
  private var failingOnceFor: Set<String>

  init(failingOnceFor: Set<String>) {
    self.failingOnceFor = failingOnceFor
  }

  func downloadCalls() -> [String] {
    calls
  }

  func downloadURL(
    configuration _: MTeamProviderConfiguration,
    torrentID: String
  ) async throws -> URL {
    calls.append(torrentID)
    if failingOnceFor.remove(torrentID) != nil {
      throw BatchImportTestError.temporaryFailure
    }
    return URL(string: "https://tracker.example.test/\(torrentID).torrent")!
  }

  func detail(
    configuration _: MTeamProviderConfiguration,
    torrent _: MTeamTorrent
  ) async throws -> MTeamTorrentDetail {
    throw BatchImportTestError.unexpectedCall
  }

  func search(
    configuration _: MTeamProviderConfiguration,
    query _: String,
    filters _: MTeamSearchFilters,
    page _: Int
  ) async throws -> MTeamSearchPage {
    throw BatchImportTestError.unexpectedCall
  }
}

@MainActor
private final class BatchTorrentAdder: MTeamBatchTorrentAdding {
  private(set) var addedURLs: [String] = []

  func addTorrent(
    _ request: TorrentAddRequest,
    to serverID: UUID
  ) async throws -> ServerConfiguration {
    guard case .url(let url) = request.source else {
      throw BatchImportTestError.unexpectedCall
    }
    addedURLs.append(url)
    return ServerConfiguration(
      id: serverID,
      name: "Test Server",
      baseURL: URL(string: "https://server.example.test")!,
      username: "tester"
    )
  }
}

private enum BatchImportTestError: Error {
  case temporaryFailure
  case unexpectedCall
}
