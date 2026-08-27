import Foundation

struct HelperSubscriptionCoordinator: Sendable {
  private let service: any HelperService
  private let maximumWriteAttempts: Int

  init(service: any HelperService, maximumWriteAttempts: Int = 3) {
    self.service = service
    self.maximumWriteAttempts = maximumWriteAttempts
  }

  func upsert(
    _ proposed: HelperReplica,
    at baseURL: URL,
    token: String
  ) async throws -> HelperSubscriptionMutation {
    try await mutate(at: baseURL, token: token) { current in
      var replicas = current.replicas
      if let index = replicas.firstIndex(where: {
        $0.bangumiId == proposed.bangumiId && $0.subgroupId == proposed.subgroupId
      }) {
        let existing = replicas[index]
        replicas[index] = HelperReplica(
          id: existing.id,
          bangumiId: proposed.bangumiId,
          title: proposed.title,
          bangumiSubjectId: proposed.bangumiSubjectId,
          subgroupId: proposed.subgroupId,
          subgroupName: proposed.subgroupName,
          rssUrl: proposed.rssUrl
        )
      } else {
        replicas.append(proposed)
      }
      return replicas
    }
  }

  func remove(
    replicaID: String,
    at baseURL: URL,
    token: String
  ) async throws -> HelperSubscriptionMutation {
    try await mutate(at: baseURL, token: token) { current in
      current.replicas.filter { $0.id != replicaID }
    }
  }

  private func mutate(
    at baseURL: URL,
    token: String,
    transform: (HelperSubscriptionSnapshot) -> [HelperReplica]
  ) async throws -> HelperSubscriptionMutation {
    var current = try await service.subscriptions(at: baseURL, token: token)
    var mergedConflict = false

    for _ in 0..<maximumWriteAttempts {
      let desired = transform(current)
      if desired == current.replicas {
        return HelperSubscriptionMutation(
          snapshot: current,
          mergedConflict: mergedConflict
        )
      }

      do {
        let saved = try await service.replaceSubscriptions(
          at: baseURL,
          token: token,
          revision: current.revision,
          replicas: desired
        )
        return HelperSubscriptionMutation(
          snapshot: saved,
          mergedConflict: mergedConflict
        )
      } catch HelperServiceError.revisionConflict(let latest) {
        current = latest
        mergedConflict = true
      }
    }

    throw HelperSubscriptionCoordinatorError.conflictLimitReached
  }
}

enum HelperSubscriptionCoordinatorError: LocalizedError {
  case conflictLimitReached

  var errorDescription: String? {
    String(localized: "Helper 上的订阅仍在被其他客户端修改，请稍后重试。")
  }
}
