import Foundation

protocol HelperService: Sendable {
  func status(for server: ServerConfiguration) async throws -> HelperStatus
}

struct HelperStatus: Hashable, Sendable {
  let version: String
  let isPaired: Bool
  let pendingJobs: Int
}

struct IntegrationPlaceholderHelperService: HelperService {
  func status(for server: ServerConfiguration) async throws -> HelperStatus {
    throw IntegrationPendingError()
  }
}

