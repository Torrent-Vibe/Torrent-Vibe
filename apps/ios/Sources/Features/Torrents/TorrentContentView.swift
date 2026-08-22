import Observation
import SwiftUI

@MainActor
@Observable
final class TorrentSearchState {
  private var filtersByServerID: [UUID: TorrentFilter] = [:]
  private var serverID: UUID?

  var filter: TorrentFilter = .all
  var query = ""

  func activate(serverID: UUID?) {
    if let currentServerID = self.serverID {
      filtersByServerID[currentServerID] = filter
    }
    self.serverID = serverID
    filter = serverID.flatMap { filtersByServerID[$0] } ?? .all
  }

  func select(_ filter: TorrentFilter) {
    self.filter = filter
    if let serverID {
      filtersByServerID[serverID] = filter
    }
  }
}

@MainActor
@Observable
final class TorrentSelectionState {
  var isPerformingAction = false
  var isSelecting = false
  var selectedIDs = Set<String>()

  func begin() {
    selectedIDs.removeAll()
    isSelecting = true
  }

  func end() {
    selectedIDs.removeAll()
    isSelecting = false
    isPerformingAction = false
  }

  func toggle(_ torrentID: String) {
    if selectedIDs.contains(torrentID) {
      selectedIDs.remove(torrentID)
    } else {
      selectedIDs.insert(torrentID)
    }
  }
}

struct TorrentContentView: View {
  @Environment(AppModel.self) private var model
  @Environment(TorrentSearchState.self) private var searchState
  @Environment(TorrentSelectionState.self) private var selectionState
  @State private var pagingBridge = TorrentFilterPagingBridge()

  let onOpenServers: () -> Void
  let onOpenTorrent: (TorrentSummary) -> Void
  let onDeleteTorrent: (TorrentSummary) -> Void
  let onManageTorrent: (TorrentSummary) -> Void
  let onToggleSelection: (TorrentSummary) -> Void
  let onTogglePause: (TorrentSummary) -> Void

  var body: some View {
    Group {
      if model.activeServer == nil {
        ContentUnavailableView {
          Label("尚未添加服务器", systemImage: "externaldrive.badge.plus")
        } description: {
          Text("先添加一台 qBittorrent 服务器，再开始管理下载任务。")
        } actions: {
          Button("前往服务器", action: onOpenServers)
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("torrent-open-servers")
        }
      } else if model.torrents.isEmpty {
        ContentUnavailableView {
          Label("任务将在连接后显示", systemImage: "arrow.down.circle")
        } description: {
          Text(model.integrationNotice ?? "当前服务器没有符合条件的任务。")
        }
      } else {
        TorrentFilterPagerView(
          model: model,
          selectionState: selectionState,
          selection: searchState.filter,
          query: searchState.query,
          pagingBridge: pagingBridge,
          onSelectFilter: { searchState.select($0) },
          onOpenTorrent: onOpenTorrent,
          onDeleteTorrent: onDeleteTorrent,
          onManageTorrent: onManageTorrent,
          onToggleSelection: onToggleSelection,
          onTogglePause: onTogglePause
        )
        .ignoresSafeArea()
        .safeAreaBar(edge: .top, spacing: 0) {
          TorrentFilterTabsView(
            counts: TorrentFilterCounting.counts(for: model.torrents),
            selection: searchState.filter,
            pagingBridge: pagingBridge,
            onSelect: { searchState.select($0) }
          )
          .padding(.horizontal, 16)
          .padding(.vertical, 4)
        }
      }
    }
  }
}
