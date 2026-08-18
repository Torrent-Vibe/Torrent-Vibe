import Foundation
import XCTest

@testable import Torrent_Vibe

final class ContentSourceConnectionTesterTests: XCTestCase {
  override func tearDown() {
    ContentSourceStubURLProtocol.handler = nil
    super.tearDown()
  }

  func testMikanProbeUsesReadOnlyRootRequest() async throws {
    ContentSourceStubURLProtocol.handler = { request in
      XCTAssertEqual(request.url?.absoluteString, "https://mikanani.me/")
      XCTAssertEqual(request.httpMethod, "GET")
      XCTAssertNil(request.httpBody)
      return try Self.response(request, data: Data("<html>Mikan</html>".utf8))
    }

    let result = try await makeTester().testMikan(
      baseURL: try XCTUnwrap(URL(string: "https://mikanani.me/"))
    )

    XCTAssertEqual(result.message, "Mikan 连接正常")
  }

  func testMikanProbeRejectsAnEmptyDocument() async throws {
    ContentSourceStubURLProtocol.handler = { request in
      try Self.response(request, data: Data())
    }

    do {
      _ = try await makeTester().testMikan(
        baseURL: try XCTUnwrap(URL(string: "https://mikanani.me/"))
      )
      XCTFail("Expected an empty document error")
    } catch let error as ContentSourceConnectionError {
      guard case .invalidMikanDocument = error else {
        return XCTFail("Unexpected error: \(error)")
      }
    }
  }

  func testMTeamProbeUsesOnlyTheSearchContract() async throws {
    let service = RecordingMTeamService()
    let tester = URLSessionContentSourceConnectionTester(mteamService: service)
    let configuration = try MTeamProviderConfiguration(
      baseURLText: "https://api.m-team.cc/api",
      apiKey: "draft-key",
      pageSize: 25
    )

    let result = try await tester.testMTeam(configuration: configuration, mode: "tv")
    let recordedRequest = await service.lastSearchRequest()
    let detailCallCount = await service.detailCallCount()
    let downloadCallCount = await service.downloadCallCount()
    let request = try XCTUnwrap(recordedRequest)

    XCTAssertEqual(result.message, "M-Team 连接正常，已完成只读检索")
    XCTAssertEqual(request.configuration, configuration)
    XCTAssertEqual(request.query, "")
    XCTAssertEqual(request.filters.mode, "tv")
    XCTAssertEqual(request.page, 1)
    XCTAssertEqual(detailCallCount, 0)
    XCTAssertEqual(downloadCallCount, 0)
  }

  private func makeTester() -> URLSessionContentSourceConnectionTester {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [ContentSourceStubURLProtocol.self]
    return URLSessionContentSourceConnectionTester(
      mikanSession: URLSession(configuration: configuration)
    )
  }

  private static func response(
    _ request: URLRequest,
    status: Int = 200,
    data: Data
  ) throws -> (HTTPURLResponse, Data) {
    let response = try XCTUnwrap(
      HTTPURLResponse(
        url: try XCTUnwrap(request.url),
        statusCode: status,
        httpVersion: nil,
        headerFields: ["Content-Type": "text/html; charset=utf-8"]
      )
    )
    return (response, data)
  }
}

private struct RecordedMTeamSearchRequest: Sendable {
  let configuration: MTeamProviderConfiguration
  let filters: MTeamSearchFilters
  let page: Int
  let query: String
}

private actor RecordingMTeamService: MTeamService {
  private var downloadCalls = 0
  private var detailCalls = 0
  private var searchRequest: RecordedMTeamSearchRequest?

  func search(
    configuration: MTeamProviderConfiguration,
    query: String,
    filters: MTeamSearchFilters,
    page: Int
  ) async throws -> MTeamSearchPage {
    searchRequest = RecordedMTeamSearchRequest(
      configuration: configuration,
      filters: filters,
      page: page,
      query: query
    )
    return MTeamSearchPage(
      hasMore: false,
      items: [],
      page: 1,
      pageSize: configuration.pageSize,
      total: 0,
      totalPages: 0
    )
  }

  func detail(
    configuration _: MTeamProviderConfiguration,
    torrent _: MTeamTorrent
  ) async throws -> MTeamTorrentDetail {
    detailCalls += 1
    throw RecordingMTeamServiceError.unexpectedMutation
  }

  func downloadURL(
    configuration _: MTeamProviderConfiguration,
    torrentID _: String
  ) async throws -> URL {
    downloadCalls += 1
    throw RecordingMTeamServiceError.unexpectedMutation
  }

  func lastSearchRequest() -> RecordedMTeamSearchRequest? {
    searchRequest
  }

  func detailCallCount() -> Int {
    detailCalls
  }

  func downloadCallCount() -> Int {
    downloadCalls
  }
}

private enum RecordingMTeamServiceError: Error {
  case unexpectedMutation
}

private final class ContentSourceStubURLProtocol: URLProtocol, @unchecked Sendable {
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
