import Foundation

protocol HelperService: Sendable {
  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo
  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential
  func status(at baseURL: URL, token: String) async throws -> HelperStatus
  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot
  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot
  func subscriptions(at baseURL: URL, token: String) async throws
    -> HelperSubscriptionSnapshot
  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot
  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus
  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult
  func retry(
    at baseURL: URL,
    token: String,
    request: HelperRetryRequest
  ) async throws -> HelperBackfillResult
  func events(
    at baseURL: URL,
    token: String,
    since: UInt64?,
    level: String?,
    replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage
  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String
  func check(at baseURL: URL, token: String) async throws
  func unpair(at baseURL: URL, token: String) async throws
}

enum HelperCapability: String, Sendable {
  case check
  case events
  case logs
}

struct HelperDiscoveryInfo: Hashable, Sendable {
  let version: String
  let capabilities: [String]
  let clientCount: Int
  let requiresPairingCode: Bool

  func supports(_ capability: HelperCapability) -> Bool {
    capabilities.contains(capability.rawValue)
  }
}

struct HelperPairingCredential: Hashable, Sendable {
  let clientID: String
  let token: String
}

struct HelperStatus: Hashable, Sendable {
  let version: String
  let clientCount: Int
  let subscriptionCount: Int
  let pendingItems: Int
}

struct URLSessionHelperService: HelperService {
  private let session: URLSession

  init(session: URLSession = .shared) {
    self.session = session
  }

  func discover(at baseURL: URL) async throws -> HelperDiscoveryInfo {
    let payload: DiscoverPayload = try await request(baseURL, path: "discover")
    guard payload.requiresPairingCode else {
      throw HelperServiceError.unsupportedProtocol
    }
    return HelperDiscoveryInfo(
      version: payload.version,
      capabilities: payload.capabilities ?? [],
      clientCount: payload.clientCount,
      requiresPairingCode: payload.requiresPairingCode
    )
  }

  func pair(
    at baseURL: URL,
    code: String,
    clientID: String,
    clientName: String
  ) async throws -> HelperPairingCredential {
    let body = PairRequest(code: code, clientId: clientID, clientName: clientName)
    let payload: PairPayload = try await request(
      baseURL,
      path: "pair",
      method: "POST",
      body: body
    )
    guard !payload.token.isEmpty else {
      throw HelperServiceError.invalidResponse
    }
    return HelperPairingCredential(
      clientID: payload.clientId.isEmpty ? clientID : payload.clientId,
      token: payload.token
    )
  }

  func status(at baseURL: URL, token: String) async throws -> HelperStatus {
    async let discovery = discover(at: baseURL)
    async let status = runtimeStatus(at: baseURL, token: token)
    let (discoveryInfo, statusPayload) = try await (discovery, status)
    let episodes =
      statusPayload.replicas.flatMap(\.episodes) + statusPayload.jobs.flatMap(\.episodes)
    let pendingItems = episodes.count { ![.done, .skipped].contains($0.state) }
    return HelperStatus(
      version: discoveryInfo.version,
      clientCount: discoveryInfo.clientCount,
      subscriptionCount: statusPayload.replicas.count,
      pendingItems: pendingItems
    )
  }

  func profile(at baseURL: URL, token: String) async throws -> HelperProfileSnapshot {
    try await request(baseURL, path: "profile", token: token)
  }

  func updateProfile(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    mutations: [HelperProfileMutation]
  ) async throws -> HelperProfileSnapshot {
    try await request(
      baseURL,
      path: "profile",
      method: "PATCH",
      token: token,
      body: UpdateProfileRequest(revision: revision, mutations: mutations)
    )
  }

  func subscriptions(at baseURL: URL, token: String) async throws
    -> HelperSubscriptionSnapshot
  {
    try await request(baseURL, path: "subscriptions", token: token)
  }

  func replaceSubscriptions(
    at baseURL: URL,
    token: String,
    revision: UInt64,
    replicas: [HelperReplica]
  ) async throws -> HelperSubscriptionSnapshot {
    try await request(
      baseURL,
      path: "subscriptions",
      method: "PUT",
      token: token,
      body: ReplaceSubscriptionsRequest(revision: revision, replicas: replicas)
    )
  }

  func runtimeStatus(at baseURL: URL, token: String) async throws -> HelperRuntimeStatus {
    try await request(baseURL, path: "status", token: token)
  }

  func backfill(
    at baseURL: URL,
    token: String,
    bangumiID: String,
    subgroupID: String,
    episodes: [HelperBackfillEpisode]
  ) async throws -> HelperBackfillResult {
    try await request(
      baseURL,
      path: "backfill",
      method: "POST",
      token: token,
      body: BackfillRequest(
        bangumiId: bangumiID,
        subgroupId: subgroupID,
        episodes: episodes
      )
    )
  }

  func retry(
    at baseURL: URL,
    token: String,
    request retryRequest: HelperRetryRequest
  ) async throws -> HelperBackfillResult {
    try await request(
      baseURL,
      path: "retry",
      method: "POST",
      token: token,
      body: retryRequest
    )
  }

  func events(
    at baseURL: URL,
    token: String,
    since: UInt64?,
    level: String?,
    replicaID: String?,
    limit: Int?
  ) async throws -> HelperEventsPage {
    var queryItems: [URLQueryItem] = []
    if let since {
      queryItems.append(URLQueryItem(name: "since", value: String(since)))
    }
    if let level {
      queryItems.append(URLQueryItem(name: "level", value: level))
    }
    if let replicaID {
      queryItems.append(URLQueryItem(name: "replicaId", value: replicaID))
    }
    if let limit {
      queryItems.append(URLQueryItem(name: "limit", value: String(limit)))
    }
    return try await request(baseURL, path: "events", token: token, queryItems: queryItems)
  }

  func logs(at baseURL: URL, token: String, tail: Int?) async throws -> String {
    var queryItems: [URLQueryItem] = []
    if let tail {
      queryItems.append(URLQueryItem(name: "tail", value: String(tail)))
    }
    return try await requestText(baseURL, path: "logs", token: token, queryItems: queryItems)
  }

  func check(at baseURL: URL, token: String) async throws {
    let _: EmptyResponse = try await request(
      baseURL,
      path: "check",
      method: "POST",
      token: token
    )
  }

  func unpair(at baseURL: URL, token: String) async throws {
    let _: EmptyResponse = try await request(
      baseURL,
      path: "unpair",
      method: "POST",
      token: token
    )
  }

  private func request<Response: Decodable>(
    _ baseURL: URL,
    path: String,
    method: String = "GET",
    token: String? = nil,
    queryItems: [URLQueryItem] = []
  ) async throws -> Response {
    try await request(
      baseURL,
      path: path,
      method: method,
      token: token,
      queryItems: queryItems,
      body: Optional<NoBody>.none
    )
  }

  private func request<Response: Decodable, Body: Encodable>(
    _ baseURL: URL,
    path: String,
    method: String = "GET",
    token: String? = nil,
    queryItems: [URLQueryItem] = [],
    body: Body?
  ) async throws -> Response {
    let bodyData = try body.map { try JSONEncoder().encode($0) }
    let data = try await send(
      baseURL,
      path: path,
      method: method,
      token: token,
      accept: "application/json",
      queryItems: queryItems,
      body: bodyData
    )
    do {
      return try JSONDecoder().decode(Response.self, from: data)
    } catch {
      throw HelperServiceError.invalidResponse
    }
  }

  private func requestText(
    _ baseURL: URL,
    path: String,
    method: String = "GET",
    token: String? = nil,
    queryItems: [URLQueryItem] = []
  ) async throws -> String {
    let data = try await send(
      baseURL,
      path: path,
      method: method,
      token: token,
      accept: "text/plain",
      queryItems: queryItems
    )
    return String(decoding: data, as: UTF8.self)
  }

  private func send(
    _ baseURL: URL,
    path: String,
    method: String,
    token: String?,
    accept: String,
    queryItems: [URLQueryItem],
    body: Data? = nil
  ) async throws -> Data {
    var request = URLRequest(url: endpoint(baseURL, path: path, queryItems: queryItems))
    request.httpMethod = method
    request.setValue(accept, forHTTPHeaderField: "Accept")
    if let token {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    if let body {
      request.httpBody = body
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw HelperServiceError.invalidResponse
    }
    switch httpResponse.statusCode {
    case 200..<300:
      return data
    case 401:
      throw HelperServiceError.unauthorized
    case 403:
      throw HelperServiceError.invalidPairingCode
    case 409:
      if let snapshot = try? JSONDecoder().decode(HelperSubscriptionSnapshot.self, from: data) {
        throw HelperServiceError.revisionConflict(snapshot)
      }
      if let snapshot = try? JSONDecoder().decode(HelperProfileSnapshot.self, from: data) {
        throw HelperServiceError.profileRevisionConflict(snapshot)
      }
      throw HelperServiceError.httpStatus(httpResponse.statusCode)
    default:
      throw HelperServiceError.httpStatus(httpResponse.statusCode)
    }
  }

  private func endpoint(_ baseURL: URL, path: String, queryItems: [URLQueryItem]) -> URL {
    let url = baseURL.appending(path: path)
    guard !queryItems.isEmpty,
      var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    else {
      return url
    }
    components.queryItems = queryItems
    return components.url ?? url
  }
}

enum HelperServiceError: LocalizedError, Equatable {
  case httpStatus(Int)
  case invalidPairingCode
  case invalidResponse
  case profileRevisionConflict(HelperProfileSnapshot)
  case revisionConflict(HelperSubscriptionSnapshot)
  case unauthorized
  case unsupportedProtocol

  var errorDescription: String? {
    switch self {
    case .httpStatus(let status):
      String(localized: "Helper 请求失败（HTTP \(status)）。")
    case .invalidPairingCode:
      String(localized: "配对码无效或已经过期。")
    case .invalidResponse:
      String(localized: "Helper 返回了无法识别的数据。")
    case .profileRevisionConflict:
      String(localized: "Helper 凭证 Profile 已被其他客户端更新。")
    case .revisionConflict:
      String(localized: "Helper 订阅已被其他客户端更新。")
    case .unauthorized:
      String(localized: "此设备的 Helper 授权已失效，请重新配对。")
    case .unsupportedProtocol:
      String(localized: "Helper 版本不支持独立客户端配对，请先升级 Helper。")
    }
  }
}

private struct DiscoverPayload: Decodable {
  let version: String
  let capabilities: [String]?
  let clientCount: Int
  let requiresPairingCode: Bool
}

private struct UpdateProfileRequest: Encodable {
  let revision: UInt64
  let mutations: [HelperProfileMutation]
}

private struct PairRequest: Encodable {
  let code: String
  let clientId: String
  let clientName: String
}

private struct PairPayload: Decodable {
  let clientId: String
  let token: String
}

private struct ReplaceSubscriptionsRequest: Encodable {
  let revision: UInt64
  let replicas: [HelperReplica]
}

private struct BackfillRequest: Encodable {
  let bangumiId: String
  let subgroupId: String
  let episodes: [HelperBackfillEpisode]
}

private struct NoBody: Encodable {}

private struct EmptyResponse: Decodable {
  init(from decoder: Decoder) throws {
    _ = try? decoder.singleValueContainer()
  }
}
