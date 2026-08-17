import Foundation

struct MikanBangumiCard: Codable, Hashable, Identifiable, Sendable {
  let bangumiId: String
  let coverUrl: String?
  let title: String
  let weekday: Int?

  var id: String { bangumiId }
}

struct MikanWeekdayGroup: Codable, Hashable, Identifiable, Sendable {
  let weekday: Int
  let items: [MikanBangumiCard]

  var id: Int { weekday }
}

struct MikanSeasonWall: Codable, Hashable, Sendable {
  let groups: [MikanWeekdayGroup]
  let season: String
  let year: Int
}

struct MikanSubgroup: Codable, Hashable, Identifiable, Sendable {
  let id: String
  let name: String
}

struct MikanEpisode: Codable, Hashable, Identifiable, Sendable {
  let episodeId: String
  let subgroupId: String?
  let title: String
  let torrentUrl: String
  let sizeBytes: Int64?
  let publishedAt: String?

  var id: String { episodeId }
}

struct MikanBangumiDetail: Codable, Hashable, Sendable {
  let bangumiId: String
  let bangumiSubjectId: String?
  let coverUrl: String?
  let episodes: [MikanEpisode]
  let subgroups: [MikanSubgroup]
  let title: String
}

struct MikanRssEpisode: Codable, Hashable, Identifiable, Sendable {
  let episodeId: String
  let publishedAt: String?
  let sizeBytes: Int64?
  let title: String
  let torrentUrl: String

  var id: String { episodeId }
}

struct MikanParsedTitle: Codable, Hashable, Sendable {
  let episode: Int?
  let season: Int?
  let title: String
}
