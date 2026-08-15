import Foundation

struct ServerConfiguration: Codable, Hashable, Identifiable, Sendable {
  let id: UUID
  var name: String
  var baseURL: URL
  var username: String
  var helperBaseURL: URL?

  init(
    id: UUID = UUID(),
    name: String,
    baseURL: URL,
    username: String,
    helperBaseURL: URL? = nil
  ) {
    self.id = id
    self.name = name
    self.baseURL = baseURL
    self.username = username
    self.helperBaseURL = helperBaseURL
  }
}

