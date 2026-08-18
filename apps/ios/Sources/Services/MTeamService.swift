import Foundation

struct MTeamProviderConfiguration: Hashable, Sendable {
  let apiKey: String
  let baseURL: URL
  let pageSize: Int

  init(baseURLText: String, apiKey: String, pageSize: Int) throws {
    let normalizedBaseURL = baseURLText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard
      let baseURL = URL(string: normalizedBaseURL),
      ["http", "https"].contains(baseURL.scheme?.lowercased() ?? ""),
      baseURL.host != nil
    else {
      throw MTeamServiceError.invalidBaseURL
    }

    let normalizedAPIKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedAPIKey.isEmpty else {
      throw MTeamServiceError.missingAPIKey
    }
    guard (1...100).contains(pageSize) else {
      throw MTeamServiceError.invalidPageSize
    }

    self.apiKey = normalizedAPIKey
    self.baseURL = baseURL
    self.pageSize = pageSize
  }
}

struct MTeamSearchFilters: Hashable, Sendable {
  var categories: [Int] = []
  var discount: String?
  var mode = "normal"
}

struct MTeamTorrent: Hashable, Identifiable, Sendable {
  let category: String?
  let createdAt: Date?
  let discount: String?
  let discountEndsAt: Date?
  let doubanURL: URL?
  let id: String
  let imdbURL: URL?
  let leechers: Int?
  let seeders: Int?
  let sizeBytes: Int64?
  let snatches: Int?
  let synopsis: String?
  let tags: [String]
  let title: String
}

struct MTeamTorrentFile: Hashable, Identifiable, Sendable {
  let name: String
  let sizeBytes: Int64?

  var id: String { name }
}

struct MTeamTorrentDetail: Hashable, Sendable {
  let description: String?
  let files: [MTeamTorrentFile]
  let mediaInfo: String?
  let originFileName: String?
  let screenshots: [URL]
  let torrent: MTeamTorrent
}

struct MTeamSearchPage: Hashable, Sendable {
  let hasMore: Bool
  let items: [MTeamTorrent]
  let page: Int
  let pageSize: Int
  let total: Int
  let totalPages: Int
}

protocol MTeamService: Sendable {
  func detail(
    configuration: MTeamProviderConfiguration,
    torrent: MTeamTorrent
  ) async throws -> MTeamTorrentDetail
  func downloadURL(
    configuration: MTeamProviderConfiguration,
    torrentID: String
  ) async throws -> URL
  func search(
    configuration: MTeamProviderConfiguration,
    query: String,
    filters: MTeamSearchFilters,
    page: Int
  ) async throws -> MTeamSearchPage
}

actor URLSessionMTeamService: MTeamService {
  private let session: URLSession

  init(session: URLSession? = nil) {
    if let session {
      self.session = session
    } else {
      let configuration = URLSessionConfiguration.ephemeral
      configuration.timeoutIntervalForRequest = 15
      configuration.timeoutIntervalForResource = 30
      configuration.httpAdditionalHeaders = [
        "Accept-Language": "zh-CN,zh;q=0.9",
        "User-Agent": "Torrent Vibe iOS/0.1",
      ]
      self.session = URLSession(configuration: configuration)
    }
  }

  func search(
    configuration: MTeamProviderConfiguration,
    query: String,
    filters: MTeamSearchFilters,
    page: Int
  ) async throws -> MTeamSearchPage {
    let requestBody = MTeamSearchRequest(
      categories: filters.categories,
      discount: filters.discount,
      keyword: query.trimmingCharacters(in: .whitespacesAndNewlines),
      mode: filters.mode,
      pageNumber: max(page, 1),
      pageSize: configuration.pageSize,
      visible: 1
    )
    var request = try request(
      configuration: configuration,
      path: "torrent/search",
      contentType: "application/json"
    )
    request.httpBody = try JSONEncoder().encode(requestBody)

    let envelope: MTeamSearchEnvelope = try await response(for: request)
    let resolvedPage = max(envelope.data.pageNumber ?? requestBody.pageNumber, 1)
    let resolvedPageSize = max(envelope.data.pageSize ?? requestBody.pageSize, 1)
    let total = max(envelope.data.total ?? envelope.data.items.count, 0)
    let totalPages = max(
      envelope.data.totalPages ?? Int(ceil(Double(total) / Double(resolvedPageSize))),
      total == 0 ? 0 : 1
    )
    return MTeamSearchPage(
      hasMore: resolvedPage < totalPages,
      items: envelope.data.items.map(MTeamPayloadMapper.torrent),
      page: resolvedPage,
      pageSize: resolvedPageSize,
      total: total,
      totalPages: totalPages
    )
  }

  func detail(
    configuration: MTeamProviderConfiguration,
    torrent: MTeamTorrent
  ) async throws -> MTeamTorrentDetail {
    var request = try request(
      configuration: configuration,
      path: "torrent/detail",
      contentType: "application/x-www-form-urlencoded"
    )
    request.httpBody = formBody([URLQueryItem(name: "id", value: torrent.id)])
    let envelope: MTeamDetailEnvelope = try await response(for: request)
    guard let payload = envelope.data else {
      throw MTeamServiceError.missingDetail
    }
    return MTeamPayloadMapper.detail(payload, fallback: torrent)
  }

  func downloadURL(
    configuration: MTeamProviderConfiguration,
    torrentID: String
  ) async throws -> URL {
    var request = try request(
      configuration: configuration,
      path: "torrent/genDlToken",
      contentType: "application/x-www-form-urlencoded"
    )
    request.httpBody = formBody([URLQueryItem(name: "id", value: torrentID)])
    let envelope: MTeamDownloadEnvelope = try await response(for: request)
    guard let value = envelope.data?.trimmingCharacters(in: .whitespacesAndNewlines),
      let url = URL(string: value),
      ["http", "https"].contains(url.scheme?.lowercased() ?? "")
    else {
      throw MTeamServiceError.missingDownloadURL(envelope.message)
    }
    return url
  }

  private func request(
    configuration: MTeamProviderConfiguration,
    path: String,
    contentType: String
  ) throws -> URLRequest {
    let url = path.split(separator: "/").reduce(configuration.baseURL) { partial, component in
      partial.appendingPathComponent(String(component))
    }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue(contentType, forHTTPHeaderField: "Content-Type")
    request.setValue(configuration.apiKey, forHTTPHeaderField: "x-api-key")
    return request
  }

  private func response<T: Decodable>(for request: URLRequest) async throws -> T {
    let (data, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse else {
      throw MTeamServiceError.invalidResponse
    }
    guard (200..<300).contains(response.statusCode) else {
      throw MTeamServiceError.httpStatus(
        response.statusCode,
        MTeamPayloadMapper.message(from: data)
      )
    }
    do {
      return try JSONDecoder().decode(T.self, from: data)
    } catch {
      throw MTeamServiceError.invalidPayload
    }
  }

  private func formBody(_ items: [URLQueryItem]) -> Data? {
    var components = URLComponents()
    components.queryItems = items
    return components.percentEncodedQuery?.data(using: .utf8)
  }
}

struct DemoMTeamService: MTeamService {
  func search(
    configuration: MTeamProviderConfiguration,
    query: String,
    filters: MTeamSearchFilters,
    page: Int
  ) async throws -> MTeamSearchPage {
    try await Task.sleep(for: .milliseconds(180))
    let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
    let items = Self.demoItems.filter { item in
      normalizedQuery.isEmpty || item.title.localizedCaseInsensitiveContains(normalizedQuery)
        || item.synopsis?.localizedCaseInsensitiveContains(normalizedQuery) == true
    }
    return MTeamSearchPage(
      hasMore: false,
      items: page == 1 ? items : [],
      page: max(page, 1),
      pageSize: configuration.pageSize,
      total: items.count,
      totalPages: items.isEmpty ? 0 : 1
    )
  }

  func detail(
    configuration _: MTeamProviderConfiguration,
    torrent: MTeamTorrent
  ) async throws -> MTeamTorrentDetail {
    try await Task.sleep(for: .milliseconds(140))
    return MTeamTorrentDetail(
      description: "Demo Repository 提供的 M-Team 详情。该页面验证标题、资源指标、简介、文件列表与导入入口，不包含真实用户数据。",
      files: [
        MTeamTorrentFile(name: "Feature Film.mkv", sizeBytes: 18_248_196_096),
        MTeamTorrentFile(name: "Feature Film.zh-Hans.srt", sizeBytes: 82_944),
      ],
      mediaInfo: "HEVC · 2160p · HDR · Dolby Atmos",
      originFileName: "\(torrent.id).torrent",
      screenshots: [],
      torrent: torrent
    )
  }

  func downloadURL(
    configuration _: MTeamProviderConfiguration,
    torrentID: String
  ) async throws -> URL {
    try await Task.sleep(for: .milliseconds(120))
    return URL(string: "https://tracker.example.test/download/\(torrentID).torrent")!
  }

  private static let demoItems = [
    MTeamTorrent(
      category: "电影 / 4K",
      createdAt: Date(timeIntervalSince1970: 1_786_637_400),
      discount: "FREE",
      discountEndsAt: Date(timeIntervalSince1970: 1_786_723_800),
      doubanURL: URL(string: "https://movie.douban.com/subject/1295644/"),
      id: "mt-demo-4101",
      imdbURL: URL(string: "https://www.imdb.com/title/tt0088763/"),
      leechers: 24,
      seeders: 186,
      sizeBytes: 18_248_279_040,
      snatches: 932,
      synopsis: "时间旅行经典修复版，包含简繁字幕。",
      tags: ["中字", "4K"],
      title: "Back to the Future 1985 UHD BluRay 2160p HEVC Atmos-MTeam"
    ),
    MTeamTorrent(
      category: "纪录片 / 1080p",
      createdAt: Date(timeIntervalSince1970: 1_786_551_000),
      discount: "PERCENT_50",
      discountEndsAt: nil,
      doubanURL: nil,
      id: "mt-demo-4102",
      imdbURL: URL(string: "https://www.imdb.com/title/tt6769208/"),
      leechers: 8,
      seeders: 74,
      sizeBytes: 9_768_435_712,
      snatches: 418,
      synopsis: "自然纪录片完整季度资源。",
      tags: ["中字"],
      title: "The Blue Planet II S01 1080p BluRay AVC DTS-MTeam"
    ),
  ]
}

enum MTeamServiceError: LocalizedError {
  case httpStatus(Int, String?)
  case invalidBaseURL
  case invalidPageSize
  case invalidPayload
  case invalidResponse
  case missingAPIKey
  case missingDetail
  case missingDownloadURL(String?)

  var errorDescription: String? {
    switch self {
    case .httpStatus(let status, let message):
      if let message, !message.isEmpty {
        "M-Team 返回 HTTP \(status)：\(message)"
      } else {
        "M-Team 返回 HTTP \(status)。"
      }
    case .invalidBaseURL:
      "M-Team Base URL 必须使用 http:// 或 https://。"
    case .invalidPageSize:
      "M-Team 每页数量必须介于 1 到 100。"
    case .invalidPayload:
      "M-Team 返回了无法识别的数据。"
    case .invalidResponse:
      "M-Team 返回了无效响应。"
    case .missingAPIKey:
      "请先在设置中保存 M-Team API Key。"
    case .missingDetail:
      "M-Team 没有返回此 Torrent 的详情。"
    case .missingDownloadURL(let message):
      message?.isEmpty == false ? message : "M-Team 没有返回 Torrent 下载链接。"
    }
  }
}

private struct MTeamSearchRequest: Encodable {
  let categories: [Int]
  let discount: String?
  let keyword: String
  let mode: String
  let pageNumber: Int
  let pageSize: Int
  let visible: Int

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(categories, forKey: .categories)
    if !keyword.isEmpty {
      try container.encode(keyword, forKey: .keyword)
    }
    try container.encode(mode, forKey: .mode)
    try container.encode(pageNumber, forKey: .pageNumber)
    try container.encode(pageSize, forKey: .pageSize)
    try container.encode(visible, forKey: .visible)
    if let discount, discount != "any" {
      try container.encode(discount, forKey: .discount)
    }
  }

  private enum CodingKeys: String, CodingKey {
    case categories
    case discount
    case keyword
    case mode
    case pageNumber
    case pageSize
    case visible
  }
}

private struct MTeamSearchEnvelope: Decodable {
  let data: Page

  struct Page: Decodable {
    let items: [MTeamItemPayload]
    let pageNumber: Int?
    let pageSize: Int?
    let total: Int?
    let totalPages: Int?

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      items = try container.decodeIfPresent([MTeamItemPayload].self, forKey: .items) ?? []
      pageNumber = container.flexibleInt(forKey: .pageNumber)
      pageSize = container.flexibleInt(forKey: .pageSize)
      total = container.flexibleInt(forKey: .total)
      totalPages = container.flexibleInt(forKey: .totalPages)
    }

    private enum CodingKeys: String, CodingKey {
      case items = "data"
      case pageNumber
      case pageSize
      case total
      case totalPages
    }
  }
}

private struct MTeamDetailEnvelope: Decodable {
  let data: MTeamItemPayload?
}

private struct MTeamDownloadEnvelope: Decodable {
  let data: String?
  let message: String?
}

private struct MTeamItemPayload: Decodable {
  let category: String?
  let createdDate: String?
  let description: String?
  let discount: String?
  let discountEndTime: String?
  let douban: String?
  let fileList: [MTeamFilePayload]
  let id: String
  let imageList: [String]
  let imdb: String?
  let labels: [String]
  let leechers: Int?
  let mediaInfo: String?
  let name: String?
  let originFileName: String?
  let seeders: Int?
  let size: Int64?
  let smallDescription: String?
  let snatches: Int?
  let title: String?

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    category = container.flexibleString(forKey: .category)
    createdDate =
      container.flexibleString(forKey: .createdDate)
      ?? container.flexibleString(forKey: .createDate)
    description =
      container.flexibleString(forKey: .description)
      ?? container.flexibleString(forKey: .descr)
    douban = container.flexibleString(forKey: .douban)
    fileList = try container.decodeIfPresent([MTeamFilePayload].self, forKey: .fileList) ?? []
    id = container.flexibleString(forKey: .id) ?? ""
    imageList = try container.decodeIfPresent([String].self, forKey: .imageList) ?? []
    imdb = container.flexibleString(forKey: .imdb)
    labels = try container.decodeIfPresent([String].self, forKey: .labels) ?? []
    mediaInfo = container.flexibleString(forKey: .mediaInfo)
    name = container.flexibleString(forKey: .name)
    originFileName = container.flexibleString(forKey: .originFileName)
    size = container.flexibleInt64(forKey: .size)
    smallDescription = container.flexibleString(forKey: .smallDescription)
    title = container.flexibleString(forKey: .title)

    if let status = try container.decodeIfPresent(MTeamStatusPayload.self, forKey: .status) {
      discount = status.discount
      discountEndTime = status.discountEndTime
      leechers = status.leechers
      seeders = status.seeders
      snatches = status.snatches
    } else {
      discount = nil
      discountEndTime = nil
      leechers = nil
      seeders = nil
      snatches = nil
    }
  }

  private enum CodingKeys: String, CodingKey {
    case category
    case createDate
    case createdDate
    case descr
    case description
    case douban
    case fileList
    case id
    case imageList
    case imdb
    case labels = "labelsNew"
    case mediaInfo = "mediainfo"
    case name
    case originFileName
    case size
    case smallDescription = "smallDescr"
    case status
    case title
  }
}

private struct MTeamStatusPayload: Decodable {
  let discount: String?
  let discountEndTime: String?
  let leechers: Int?
  let seeders: Int?
  let snatches: Int?

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    discount = container.flexibleString(forKey: .discount)
    discountEndTime = container.flexibleString(forKey: .discountEndTime)
    leechers = container.flexibleInt(forKey: .leechers)
    seeders = container.flexibleInt(forKey: .seeders)
    snatches =
      container.flexibleInt(forKey: .snatches)
      ?? container.flexibleInt(forKey: .timesCompleted)
  }

  private enum CodingKeys: String, CodingKey {
    case discount
    case discountEndTime
    case leechers
    case seeders
    case snatches
    case timesCompleted
  }
}

private struct MTeamFilePayload: Decodable {
  let name: String
  let size: Int64?

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    name = container.flexibleString(forKey: .name) ?? "未知文件"
    size = container.flexibleInt64(forKey: .size)
  }

  private enum CodingKeys: String, CodingKey {
    case name
    case size
  }
}

private enum MTeamPayloadMapper {
  static func torrent(_ payload: MTeamItemPayload) -> MTeamTorrent {
    let tags = payload.labels
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    let category = tags.isEmpty ? payload.category : tags.joined(separator: " / ")
    return MTeamTorrent(
      category: category,
      createdAt: date(payload.createdDate),
      discount: payload.discount,
      discountEndsAt: date(payload.discountEndTime),
      doubanURL: validatedWebURL(payload.douban),
      id: payload.id,
      imdbURL: validatedWebURL(payload.imdb),
      leechers: payload.leechers,
      seeders: payload.seeders,
      sizeBytes: payload.size,
      snatches: payload.snatches,
      synopsis: normalizedInlineText(payload.smallDescription),
      tags: tags,
      title: firstNonEmpty(payload.title, payload.name) ?? "未命名 Torrent"
    )
  }

  static func detail(
    _ payload: MTeamItemPayload,
    fallback: MTeamTorrent
  ) -> MTeamTorrentDetail {
    let mapped = torrent(payload)
    let torrent = MTeamTorrent(
      category: mapped.category ?? fallback.category,
      createdAt: mapped.createdAt ?? fallback.createdAt,
      discount: mapped.discount ?? fallback.discount,
      discountEndsAt: mapped.discountEndsAt ?? fallback.discountEndsAt,
      doubanURL: mapped.doubanURL ?? fallback.doubanURL,
      id: payload.id.isEmpty ? fallback.id : payload.id,
      imdbURL: mapped.imdbURL ?? fallback.imdbURL,
      leechers: mapped.leechers ?? fallback.leechers,
      seeders: mapped.seeders ?? fallback.seeders,
      sizeBytes: mapped.sizeBytes ?? fallback.sizeBytes,
      snatches: mapped.snatches ?? fallback.snatches,
      synopsis: mapped.synopsis ?? fallback.synopsis,
      tags: mapped.tags.isEmpty ? fallback.tags : mapped.tags,
      title: mapped.title == "未命名 Torrent" ? fallback.title : mapped.title
    )
    let description = payload.description.flatMap(cleanDescription)
    let screenshots = uniqueWebURLs(
      payload.imageList + imageURLs(in: payload.description ?? "")
    )
    return MTeamTorrentDetail(
      description: description,
      files: payload.fileList.map {
        MTeamTorrentFile(name: $0.name, sizeBytes: $0.size)
      },
      mediaInfo: payload.mediaInfo,
      originFileName: payload.originFileName,
      screenshots: screenshots,
      torrent: torrent
    )
  }

  static func message(from data: Data) -> String? {
    (try? JSONDecoder().decode(MTeamDownloadEnvelope.self, from: data))?.message
  }

  private static func cleanDescription(_ value: String) -> String? {
    var result = value
    let patterns = [
      #"(?is)\[img\].*?\[/img\]"#,
      #"(?is)!\[[^\]]*\]\([^\)]+\)"#,
      #"(?is)\[/?(?:url|b|i|u|quote|size|color)[^\]]*\]"#,
    ]
    for pattern in patterns {
      result = result.replacingOccurrences(
        of: pattern,
        with: "",
        options: .regularExpression
      )
    }
    result =
      result
      .replacingOccurrences(of: "\r\n", with: "\n")
      .replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return result.isEmpty ? nil : result
  }

  private static func imageURLs(in value: String) -> [String] {
    let patterns = [
      #"(?is)\[img\](https?://[^\[]+)\[/img\]"#,
      #"(?is)!\[[^\]]*\]\((https?://[^\)]+)\)"#,
    ]
    return patterns.flatMap { pattern -> [String] in
      guard let expression = try? NSRegularExpression(pattern: pattern) else { return [] }
      let range = NSRange(value.startIndex..<value.endIndex, in: value)
      return expression.matches(in: value, range: range).compactMap { match in
        guard match.numberOfRanges > 1, let range = Range(match.range(at: 1), in: value) else {
          return nil
        }
        return String(value[range]).trimmingCharacters(in: .whitespacesAndNewlines)
      }
    }
  }

  private static func uniqueWebURLs(_ values: [String]) -> [URL] {
    var seen = Set<URL>()
    return values.compactMap(validatedWebURL).filter { seen.insert($0).inserted }
  }

  private static func validatedWebURL(_ value: String?) -> URL? {
    guard let value, let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
      ["http", "https"].contains(url.scheme?.lowercased() ?? "")
    else { return nil }
    return url
  }

  private static func firstNonEmpty(_ values: String?...) -> String? {
    values.lazy.compactMap { value in
      let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines)
      return normalized?.isEmpty == false ? normalized : nil
    }.first
  }

  private static func normalizedInlineText(_ value: String?) -> String? {
    guard let value else { return nil }
    let normalized =
      value
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return normalized.isEmpty ? nil : normalized
  }

  private static func date(_ value: String?) -> Date? {
    guard let value else { return nil }
    if let numeric = Double(value) {
      return Date(timeIntervalSince1970: numeric > 1_000_000_000_000 ? numeric / 1_000 : numeric)
    }
    let isoFormatter = ISO8601DateFormatter()
    if let date = isoFormatter.date(from: value) {
      return date
    }
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 8 * 60 * 60)
    formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
    return formatter.date(from: value)
  }
}

extension KeyedDecodingContainer {
  fileprivate func flexibleString(forKey key: Key) -> String? {
    if let value = try? decode(String.self, forKey: key) {
      return value
    }
    if let value = try? decode(Int64.self, forKey: key) {
      return String(value)
    }
    if let value = try? decode(Double.self, forKey: key) {
      return String(value)
    }
    return nil
  }

  fileprivate func flexibleInt(forKey key: Key) -> Int? {
    if let value = try? decode(Int.self, forKey: key) {
      return value
    }
    if let value = flexibleString(forKey: key) {
      return Int(value)
    }
    return nil
  }

  fileprivate func flexibleInt64(forKey key: Key) -> Int64? {
    if let value = try? decode(Int64.self, forKey: key) {
      return value
    }
    if let value = flexibleString(forKey: key) {
      return Int64(value)
    }
    return nil
  }
}
