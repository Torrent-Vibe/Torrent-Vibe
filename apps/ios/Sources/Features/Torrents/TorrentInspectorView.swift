import Observation
import SwiftUI
import UIKit

enum TorrentInspectorKind: String, CaseIterable, Identifiable {
  case files
  case trackers
  case peers

  var id: String { rawValue }

  var title: String {
    switch self {
    case .files: "文件"
    case .trackers: "Tracker"
    case .peers: "Peer"
    }
  }

  var systemImage: String {
    switch self {
    case .files: "doc.on.doc"
    case .trackers: "antenna.radiowaves.left.and.right"
    case .peers: "person.2"
    }
  }

  var accessibilityIdentifier: String {
    "torrent-inspector-\(rawValue)"
  }
}

@MainActor
@Observable
private final class TorrentInspectorState {
  var errorMessage: String?
  var files: [TorrentFileSummary] = []
  var isLoading = false
  var peers: [TorrentPeerSummary] = []
  var trackers: [TorrentTrackerSummary] = []

  let kind: TorrentInspectorKind

  private let model: AppModel
  private let serverID: UUID
  private let torrentID: String
  private var hasLoaded = false

  init(
    kind: TorrentInspectorKind,
    model: AppModel,
    torrentID: String,
    serverID: UUID
  ) {
    self.kind = kind
    self.model = model
    self.torrentID = torrentID
    self.serverID = serverID
  }

  func load(force: Bool = false) async {
    guard !isLoading, force || !hasLoaded else { return }
    isLoading = true
    errorMessage = nil
    defer { isLoading = false }

    do {
      switch kind {
      case .files:
        files = try await model.torrentFiles(torrentID: torrentID, serverID: serverID)
      case .trackers:
        trackers = try await model.torrentTrackers(torrentID: torrentID, serverID: serverID)
      case .peers:
        peers = try await model.torrentPeers(torrentID: torrentID, serverID: serverID)
      }
      hasLoaded = true
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}

final class TorrentInspectorViewController: SwiftUIHostingViewController {
  private let state: TorrentInspectorState

  init(
    kind: TorrentInspectorKind,
    model: AppModel,
    torrentID: String,
    serverID: UUID
  ) {
    state = TorrentInspectorState(
      kind: kind,
      model: model,
      torrentID: torrentID,
      serverID: serverID
    )
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = state.kind.title
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(TorrentInspectorContentView().environment(state))
  }
}

private struct TorrentInspectorContentView: View {
  @Environment(TorrentInspectorState.self) private var state

  var body: some View {
    List {
      if let errorMessage = state.errorMessage {
        Section {
          ContentUnavailableView(
            "无法载入\(state.kind.title)",
            systemImage: "exclamationmark.triangle",
            description: Text(errorMessage)
          )
          Button("重试") {
            Task { await state.load(force: true) }
          }
          .frame(maxWidth: .infinity)
        }
      } else if state.isLoading && isEmpty {
        Section {
          HStack(spacing: 12) {
            ProgressView()
            Text("正在载入\(state.kind.title)…")
              .foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .center)
          .padding(.vertical, 32)
        }
      } else if isEmpty {
        Section {
          ContentUnavailableView(
            "没有\(state.kind.title)数据",
            systemImage: state.kind.systemImage,
            description: Text("qBittorrent 当前没有返回可显示的内容。")
          )
        }
      } else {
        switch state.kind {
        case .files:
          fileSections
        case .trackers:
          trackerSections
        case .peers:
          peerSections
        }
      }
    }
    .accessibilityIdentifier(state.kind.accessibilityIdentifier)
    .refreshable { await state.load(force: true) }
    .task { await state.load() }
  }

  private var fileSections: some View {
    let files = state.files
    return Section("\(files.count) 个文件") {
      ForEach(files, id: \TorrentFileSummary.id) { file in
        TorrentFileInspectorRow(file: file)
      }
    }
  }

  private var trackerSections: some View {
    let trackers = state.trackers
    return Section("\(trackers.count) 个 Tracker") {
      ForEach(trackers, id: \TorrentTrackerSummary.id) { tracker in
        TorrentTrackerInspectorRow(tracker: tracker)
      }
    }
  }

  private var peerSections: some View {
    let peers = state.peers
    return Section("\(peers.count) 个 Peer") {
      ForEach(peers, id: \TorrentPeerSummary.id) { peer in
        TorrentPeerInspectorRow(peer: peer)
      }
    }
  }

  private var isEmpty: Bool {
    switch state.kind {
    case .files: state.files.isEmpty
    case .trackers: state.trackers.isEmpty
    case .peers: state.peers.isEmpty
    }
  }

}

private struct TorrentFileInspectorRow: View {
  let file: TorrentFileSummary

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(file.displayName)
          .font(.body.weight(.medium))
          .lineLimit(2)
        Spacer(minLength: 8)
        Text(file.priorityTitle)
          .font(.caption.weight(.semibold))
          .foregroundStyle(file.priority == 0 ? Color.secondary : Color.blue)
      }
      if let directory = file.directory {
        Text(directory)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
          .lineLimit(2)
      }
      ProgressView(value: file.progress)
        .tint(file.priority == 0 ? Color.secondary : Color.blue)
      HStack {
        Text(file.progress, format: .percent.precision(.fractionLength(0)))
        Spacer()
        Text(file.formattedSize)
      }
      .font(.caption.monospacedDigit())
      .foregroundStyle(.secondary)
    }
    .listRowInsets(.vertical, AppSpacing.related)
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier("torrent-file-\(file.id)")
  }
}

private struct TorrentTrackerInspectorRow: View {
  let tracker: TorrentTrackerSummary

  var body: some View {
    VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.group) {
      VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.related) {
        HStack(alignment: .firstTextBaseline) {
          Label(tracker.statusTitle, systemImage: statusSymbol)
            .font(.subheadline.weight(.semibold))
            .labelIconToTitleSpacing(TorrentInspectorRowSpacing.iconToTitle)
            .foregroundStyle(statusColor)
          Spacer()
          Text("Tier \(tracker.tier)")
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
        }
        Text(tracker.url)
          .font(.footnote.monospaced())
          .textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.related) {
        HStack(spacing: TorrentInspectorRowSpacing.metrics) {
          CompactMetric(
            item: CompactMetricItem(
              accessibilityTitle: "做种数",
              id: "tracker-seeders",
              systemImage: "arrow.up.circle",
              value: "\(tracker.seedCount)"
            )
          )
          CompactMetric(
            item: CompactMetricItem(
              accessibilityTitle: "下载数",
              id: "tracker-leechers",
              systemImage: "arrow.down.circle",
              value: "\(tracker.leechCount)"
            )
          )
          CompactMetric(
            item: CompactMetricItem(
              accessibilityTitle: "Peer 数",
              id: "tracker-peers",
              systemImage: "person.2",
              value: "\(tracker.peerCount)"
            )
          )
        }
        .font(.caption.monospacedDigit())
        if let message = tracker.message {
          Text(message)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    }
    .listRowInsets(.vertical, TorrentInspectorRowSpacing.rowVerticalInset)
    .accessibilityElement(children: .combine)
  }

  private var statusColor: Color {
    switch tracker.status {
    case 2: .green
    case 3: .blue
    case 4: .red
    default: .secondary
    }
  }

  private var statusSymbol: String {
    switch tracker.status {
    case 2: "checkmark.circle.fill"
    case 3: "arrow.clockwise.circle.fill"
    case 4: "exclamationmark.circle.fill"
    default: "circle.dashed"
    }
  }
}

private struct TorrentPeerInspectorRow: View {
  let peer: TorrentPeerSummary

  var body: some View {
    VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.group) {
      VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.related) {
        HStack(alignment: .firstTextBaseline) {
          Text(peer.client)
            .font(.body.weight(.medium))
            .lineLimit(1)
          Spacer(minLength: TorrentInspectorRowSpacing.supporting)
          Text(peer.progress, format: .percent.precision(.fractionLength(0)))
            .font(.subheadline.monospacedDigit().weight(.semibold))
        }
        Text(peer.endpoint)
          .font(.footnote.monospaced())
          .foregroundStyle(.secondary)
          .textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.supporting) {
        ProgressView(value: peer.progress)
          .tint(.blue)
        HStack(spacing: TorrentInspectorRowSpacing.metrics) {
          CompactMetric(
            item: CompactMetricItem(
              accessibilityTitle: "下载速度",
              id: "peer-download-speed",
              systemImage: "arrow.down",
              value: peer.formattedDownloadSpeed,
              color: .blue
            )
          )
          CompactMetric(
            item: CompactMetricItem(
              accessibilityTitle: "上传速度",
              id: "peer-upload-speed",
              systemImage: "arrow.up",
              value: peer.formattedUploadSpeed,
              color: .green
            )
          )
        }
        .font(.caption.monospacedDigit())
      }

      if connectionSummary != nil || peer.flagsDescription != nil {
        VStack(alignment: .leading, spacing: TorrentInspectorRowSpacing.related) {
          if let connectionSummary {
            Text(connectionSummary)
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          if let flagsDescription = peer.flagsDescription {
            Text(flagsDescription)
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
    .listRowInsets(.vertical, TorrentInspectorRowSpacing.rowVerticalInset)
    .accessibilityElement(children: .combine)
  }

  private var connectionSummary: String? {
    let values = [peer.connection, peer.flags, peer.country]
      .compactMap { $0 }
      .filter { !$0.isEmpty }
    return values.isEmpty ? nil : values.joined(separator: " · ")
  }
}

private enum TorrentInspectorRowSpacing {
  static let related = AppSpacing.atomic
  static let supporting = AppSpacing.related
  static let group = AppSpacing.group
  static let metrics = AppSpacing.metrics
  static let rowVerticalInset: CGFloat = 12
  static let iconToTitle = AppSpacing.atomic
}
