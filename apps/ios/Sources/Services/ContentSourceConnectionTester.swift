import Foundation

struct ContentSourceConnectionResult: Equatable, Sendable {
  let message: String
}

protocol ContentSourceConnectionTesting: Sendable {
  func testMikan(baseURL: URL) async throws -> ContentSourceConnectionResult
  func testMTeam(
    configuration: MTeamProviderConfiguration,
    mode: String
  ) async throws -> ContentSourceConnectionResult
}

actor URLSessionContentSourceConnectionTester: ContentSourceConnectionTesting {
  private let mikanSession: URLSession
  private let mteamService: any MTeamService

  init(
    mikanSession: URLSession? = nil,
    mteamService: any MTeamService = URLSessionMTeamService()
  ) {
    if let mikanSession {
      self.mikanSession = mikanSession
    } else {
      let configuration = URLSessionConfiguration.ephemeral
      configuration.timeoutIntervalForRequest = 15
      configuration.timeoutIntervalForResource = 30
      configuration.httpAdditionalHeaders = [
        "Accept-Language": "zh-CN,zh;q=0.9",
        "User-Agent": "Torrent Vibe iOS/0.1",
      ]
      self.mikanSession = URLSession(configuration: configuration)
    }
    self.mteamService = mteamService
  }

  func testMikan(baseURL: URL) async throws -> ContentSourceConnectionResult {
    guard
      ["http", "https"].contains(baseURL.scheme?.lowercased() ?? ""),
      baseURL.host != nil
    else {
      throw ContentSourceConnectionError.invalidMikanBaseURL
    }

    var request = URLRequest(url: baseURL)
    request.httpMethod = "GET"
    let (data, response) = try await mikanSession.data(for: request)
    guard let response = response as? HTTPURLResponse else {
      throw ContentSourceConnectionError.invalidMikanResponse
    }
    guard (200..<300).contains(response.statusCode) else {
      throw ContentSourceConnectionError.mikanHTTPStatus(response.statusCode)
    }
    guard !data.isEmpty, String(data: data, encoding: .utf8) != nil else {
      throw ContentSourceConnectionError.invalidMikanDocument
    }

    return ContentSourceConnectionResult(message: "Mikan 连接正常")
  }

  func testMTeam(
    configuration: MTeamProviderConfiguration,
    mode: String
  ) async throws -> ContentSourceConnectionResult {
    _ = try await mteamService.search(
      configuration: configuration,
      query: "",
      filters: MTeamSearchFilters(mode: mode),
      page: 1
    )
    return ContentSourceConnectionResult(message: "M-Team 连接正常，已完成只读检索")
  }
}

struct DemoContentSourceConnectionTester: ContentSourceConnectionTesting {
  func testMikan(baseURL: URL) async throws -> ContentSourceConnectionResult {
    guard
      ["http", "https"].contains(baseURL.scheme?.lowercased() ?? ""),
      baseURL.host != nil
    else {
      throw ContentSourceConnectionError.invalidMikanBaseURL
    }
    try await Task.sleep(for: .milliseconds(240))
    return ContentSourceConnectionResult(message: "Mikan 连接正常（Demo）")
  }

  func testMTeam(
    configuration: MTeamProviderConfiguration,
    mode: String
  ) async throws -> ContentSourceConnectionResult {
    _ = try await DemoMTeamService().search(
      configuration: configuration,
      query: "",
      filters: MTeamSearchFilters(mode: mode),
      page: 1
    )
    return ContentSourceConnectionResult(message: "M-Team 连接正常（Demo，只读检索）")
  }
}

enum ContentSourceConnectionError: LocalizedError {
  case invalidMikanBaseURL
  case invalidMikanDocument
  case invalidMikanResponse
  case mikanHTTPStatus(Int)

  var errorDescription: String? {
    switch self {
    case .invalidMikanBaseURL:
      "Mikan Base URL 必须是完整的 http:// 或 https:// 地址。"
    case .invalidMikanDocument:
      "Mikan 返回的页面为空或不是有效的 UTF-8 文本。"
    case .invalidMikanResponse:
      "Mikan 返回了无效响应。"
    case .mikanHTTPStatus(let status):
      "Mikan 返回 HTTP \(status)。"
    }
  }
}
