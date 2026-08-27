import Foundation

actor MikanContentService {
  private let runtime: MikanJavaScriptRuntime
  private let session: URLSession

  init(runtime: MikanJavaScriptRuntime) {
    self.runtime = runtime

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 15
    configuration.timeoutIntervalForResource = 30
    configuration.httpAdditionalHeaders = [
      "Accept-Language": "zh-CN,zh;q=0.9",
      "User-Agent": "Torrent Vibe iOS/0.1",
    ]
    session = URLSession(configuration: configuration)
  }

  func seasonWall(
    baseURL: URL,
    year: Int,
    season: String
  ) async throws -> MikanSeasonWall {
    let html = try await document(
      baseURL: baseURL,
      path: "Home/BangumiCoverFlowByDayOfWeek",
      queryItems: [
        URLQueryItem(name: "year", value: String(year)),
        URLQueryItem(name: "seasonStr", value: season),
      ]
    )
    return try await runtime.parseSeasonWall(html: html)
  }

  func search(baseURL: URL, query: String) async throws -> [MikanBangumiCard] {
    let html = try await document(
      baseURL: baseURL,
      path: "Home/Search",
      queryItems: [URLQueryItem(name: "searchstr", value: query)]
    )
    return try await runtime.parseSearchBangumi(html: html)
  }

  func detail(
    baseURL: URL,
    bangumiId: String
  ) async throws -> MikanBangumiDetail {
    let html = try await document(
      baseURL: baseURL,
      path: "Home/Bangumi/\(bangumiId)",
      queryItems: []
    )
    return try await runtime.parseBangumiDetail(
      html: html,
      bangumiId: bangumiId,
      baseURL: baseURL
    )
  }

  private func document(
    baseURL: URL,
    path: String,
    queryItems: [URLQueryItem]
  ) async throws -> String {
    guard ["http", "https"].contains(baseURL.scheme?.lowercased() ?? "") else {
      throw MikanContentServiceError.invalidBaseURL
    }

    var components = URLComponents(
      url: path.split(separator: "/").reduce(baseURL) { partial, component in
        partial.appendingPathComponent(String(component))
      },
      resolvingAgainstBaseURL: false
    )
    components?.queryItems = queryItems.isEmpty ? nil : queryItems
    guard let url = components?.url else {
      throw MikanContentServiceError.invalidRequestURL
    }

    let (data, response) = try await session.data(from: url)
    guard let response = response as? HTTPURLResponse else {
      throw MikanContentServiceError.invalidResponse
    }
    guard (200..<300).contains(response.statusCode) else {
      throw MikanContentServiceError.httpStatus(response.statusCode)
    }
    guard let document = String(data: data, encoding: .utf8) else {
      throw MikanContentServiceError.invalidDocumentEncoding
    }
    return document
  }
}

enum MikanContentServiceError: LocalizedError {
  case httpStatus(Int)
  case invalidBaseURL
  case invalidDocumentEncoding
  case invalidRequestURL
  case invalidResponse

  var errorDescription: String? {
    switch self {
    case .httpStatus(let status):
      String(localized: "Mikan 返回 HTTP \(status)。")
    case .invalidBaseURL:
      String(localized: "Mikan Base URL 必须使用 http:// 或 https://。")
    case .invalidDocumentEncoding:
      String(localized: "Mikan 页面不是有效的 UTF-8 文本。")
    case .invalidRequestURL:
      String(localized: "无法生成 Mikan 请求地址。")
    case .invalidResponse:
      String(localized: "Mikan 返回了无效响应。")
    }
  }
}
