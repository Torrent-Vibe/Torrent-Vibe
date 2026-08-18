import Foundation
import XCTest

@testable import Torrent_Vibe

final class MTeamServiceTests: XCTestCase {
  override func tearDown() {
    MTeamStubURLProtocol.handler = nil
    super.tearDown()
  }

  func testSearchUsesDesktopContractAndMapsFlexibleValues() async throws {
    MTeamStubURLProtocol.handler = { request in
      XCTAssertEqual(request.url?.path, "/api/torrent/search")
      XCTAssertEqual(request.httpMethod, "POST")
      XCTAssertEqual(request.value(forHTTPHeaderField: "x-api-key"), "secret-key")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")

      let body = try XCTUnwrap(Self.bodyData(from: request))
      let payload = try XCTUnwrap(
        JSONSerialization.jsonObject(with: body) as? [String: Any]
      )
      XCTAssertEqual(payload["keyword"] as? String, "Blue Planet")
      XCTAssertEqual(payload["pageNumber"] as? Int, 2)
      XCTAssertEqual(payload["pageSize"] as? Int, 25)
      XCTAssertEqual(payload["mode"] as? String, "tv")
      XCTAssertEqual(payload["discount"] as? String, "FREE")
      XCTAssertEqual(payload["categories"] as? [Int], [401, 405])

      return try Self.response(
        request,
        json: [
          "code": "0",
          "message": "SUCCESS",
          "data": [
            "pageNumber": "2",
            "pageSize": "25",
            "total": "27",
            "totalPages": "2",
            "data": [
              [
                "id": "1035761",
                "createdDate": "2025-09-17 20:19:50",
                "name": "The Blue Planet II S01 1080p BluRay-MTeam",
                "smallDescr": "自然纪录片 完整季度",
                "category": "405",
                "size": "709450208",
                "labelsNew": ["中字", "纪录片"],
                "status": [
                  "discount": "FREE",
                  "seeders": "162",
                  "leechers": "70",
                  "timesCompleted": "32",
                ],
              ]
            ],
          ],
        ]
      )
    }

    let service = makeService()
    let result = try await service.search(
      configuration: try configuration(),
      query: " Blue Planet ",
      filters: MTeamSearchFilters(
        categories: [401, 405],
        discount: "FREE",
        mode: "tv"
      ),
      page: 2
    )

    XCTAssertFalse(result.hasMore)
    XCTAssertEqual(result.total, 27)
    XCTAssertEqual(result.totalPages, 2)
    let item = try XCTUnwrap(result.items.first)
    XCTAssertEqual(item.id, "1035761")
    XCTAssertEqual(item.category, "中字 / 纪录片")
    XCTAssertEqual(item.sizeBytes, 709_450_208)
    XCTAssertEqual(item.seeders, 162)
    XCTAssertEqual(item.leechers, 70)
    XCTAssertEqual(item.snatches, 32)
    XCTAssertEqual(item.discount, "FREE")
  }

  func testDetailExtractsImagesAndKeepsReadableDescription() async throws {
    MTeamStubURLProtocol.handler = { request in
      XCTAssertEqual(request.url?.path, "/api/torrent/detail")
      XCTAssertEqual(
        request.value(forHTTPHeaderField: "Content-Type"), "application/x-www-form-urlencoded")
      XCTAssertEqual(
        String(data: Self.bodyData(from: request) ?? Data(), encoding: .utf8), "id=1035785")

      return try Self.response(
        request,
        json: [
          "message": "SUCCESS",
          "data": [
            "id": "1035785",
            "name": "Feature Film 2160p-MTeam",
            "size": "16009852979",
            "descr":
              "[img]https://img.example/poster.jpg[/img]\n\n◎简 介\n一段正文。\n![](https://img.example/screen.png)",
            "imageList": ["https://img.example/cover.jpg"],
            "originFileName": "Feature.Film.torrent",
            "mediainfo": "HEVC · HDR",
            "fileList": [
              ["name": "Feature Film.mkv", "size": "16000000000"]
            ],
            "status": ["seeders": "31", "leechers": "4"],
          ],
        ]
      )
    }

    let fallback = MTeamTorrent(
      category: "电影",
      createdAt: nil,
      discount: nil,
      discountEndsAt: nil,
      doubanURL: nil,
      id: "1035785",
      imdbURL: nil,
      leechers: nil,
      seeders: nil,
      sizeBytes: nil,
      snatches: nil,
      synopsis: "摘要",
      tags: [],
      title: "Fallback"
    )
    let detail = try await makeService().detail(
      configuration: try configuration(),
      torrent: fallback
    )

    XCTAssertEqual(detail.torrent.title, "Feature Film 2160p-MTeam")
    XCTAssertEqual(detail.torrent.seeders, 31)
    XCTAssertEqual(detail.files.first?.name, "Feature Film.mkv")
    XCTAssertEqual(detail.originFileName, "Feature.Film.torrent")
    XCTAssertEqual(detail.screenshots.count, 3)
    XCTAssertFalse(try XCTUnwrap(detail.description).contains("[img]"))
    XCTAssertTrue(try XCTUnwrap(detail.description).contains("一段正文"))
  }

  func testDownloadURLUsesFormEndpoint() async throws {
    MTeamStubURLProtocol.handler = { request in
      XCTAssertEqual(request.url?.path, "/api/torrent/genDlToken")
      XCTAssertEqual(
        String(data: Self.bodyData(from: request) ?? Data(), encoding: .utf8), "id=1035785")
      return try Self.response(
        request,
        json: [
          "message": "SUCCESS",
          "data": "https://tracker.example/download/1035785.torrent",
        ]
      )
    }

    let url = try await makeService().downloadURL(
      configuration: try configuration(),
      torrentID: "1035785"
    )
    XCTAssertEqual(url.absoluteString, "https://tracker.example/download/1035785.torrent")
  }

  func testDemoSearchMatchesTitleWithoutLiveCredentials() async throws {
    let result = try await DemoMTeamService().search(
      configuration: try configuration(),
      query: "Blue Planet",
      filters: MTeamSearchFilters(),
      page: 1
    )

    XCTAssertEqual(result.items.map(\.id), ["mt-demo-4102"])
    XCTAssertEqual(result.total, 1)
  }

  private func makeService() -> URLSessionMTeamService {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MTeamStubURLProtocol.self]
    return URLSessionMTeamService(session: URLSession(configuration: configuration))
  }

  private func configuration() throws -> MTeamProviderConfiguration {
    try MTeamProviderConfiguration(
      baseURLText: "https://api.m-team.cc/api",
      apiKey: "secret-key",
      pageSize: 25
    )
  }

  private static func response(
    _ request: URLRequest,
    status: Int = 200,
    json: Any
  ) throws -> (HTTPURLResponse, Data) {
    let response = try XCTUnwrap(
      HTTPURLResponse(
        url: try XCTUnwrap(request.url),
        statusCode: status,
        httpVersion: nil,
        headerFields: ["Content-Type": "application/json"]
      )
    )
    return (response, try JSONSerialization.data(withJSONObject: json))
  }

  private static func bodyData(from request: URLRequest) -> Data? {
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

private final class MTeamStubURLProtocol: URLProtocol, @unchecked Sendable {
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
