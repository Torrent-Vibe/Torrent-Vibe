import SwiftUI
import UIKit

final class HelperLogViewController: SwiftUIHostingViewController {
  private let state: HelperLogState

  init(model: AppModel, serverID: UUID) {
    state = HelperLogState(model: model, serverID: serverID)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "日志"
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(HelperLogContentView(state: state))
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    state.startVisible()
    Task { await state.loadDiscoveryIfNeeded() }
  }

  override func viewWillDisappear(_ animated: Bool) {
    super.viewWillDisappear(animated)
    state.stopVisible()
  }
}

private struct HelperLogContentView: View {
  let state: HelperLogState

  var body: some View {
    VStack(spacing: 0) {
      Picker(
        "",
        selection: Binding(get: { state.tab }, set: { state.selectTab($0) })
      ) {
        Text("事件").tag(HelperLogTab.events)
        Text("原始").tag(HelperLogTab.raw)
      }
      .pickerStyle(.segmented)
      .padding()
      .accessibilityIdentifier("helper-log-tab-picker")

      tabContent(for: state.tab)
    }
  }

  @ViewBuilder
  private func tabContent(for tab: HelperLogTab) -> some View {
    if state.isLoadingDiscovery {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    } else if state.tabState(tab) == .unavailable {
      tooOldNotice
    } else if tab == .events {
      HelperLogEventsTabView(state: state)
    } else {
      HelperLogRawTabView(state: state)
    }
  }

  private var tooOldNotice: some View {
    VStack(spacing: 8) {
      Image(systemName: "exclamationmark.triangle")
        .foregroundStyle(.orange)
      Text("Helper 版本过旧，不支持该功能，请升级 Helper。")
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityIdentifier("helper-log-too-old")
  }
}

private struct HelperLogEventsTabView: View {
  let state: HelperLogState

  var body: some View {
    VStack(spacing: 8) {
      HStack(spacing: 8) {
        Picker(
          "级别",
          selection: Binding(get: { state.level }, set: { state.level = $0 })
        ) {
          ForEach(HelperLogLevel.allCases, id: \.self) { level in
            Text(level.rawValue).tag(level)
          }
        }
        .accessibilityIdentifier("helper-log-level")

        TextField("搜索", text: Binding(get: { state.search }, set: { state.search = $0 }))
          .textFieldStyle(.roundedBorder)
          .autocorrectionDisabled()
          .accessibilityIdentifier("helper-log-search")

        Button {
          UIPasteboard.general.string = state.copyEventsText()
        } label: {
          Image(systemName: "doc.on.doc")
        }
        .accessibilityIdentifier("helper-log-copy-events")
      }
      .padding(.horizontal)

      if let error = state.eventsErrorMessage, state.filteredEvents.isEmpty {
        HelperLogErrorNotice(message: error)
      } else if state.filteredEvents.isEmpty {
        Spacer()
        Text("暂无日志")
          .foregroundStyle(.secondary)
        Spacer()
      } else {
        if let error = state.eventsErrorMessage {
          HelperLogErrorBanner(message: error)
        }
        List(state.filteredEvents) { event in
          HelperLogEventRow(event: event)
        }
        .listStyle(.plain)
      }
    }
    .padding(.top, 4)
  }
}

private struct HelperLogErrorNotice: View {
  let message: String

  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "exclamationmark.triangle.fill")
        .foregroundStyle(.red)
      Text("加载失败")
        .font(.subheadline.weight(.semibold))
      Text(message)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityIdentifier("helper-log-error")
  }
}

private struct HelperLogErrorBanner: View {
  let message: String

  var body: some View {
    HStack(alignment: .top, spacing: 6) {
      Image(systemName: "exclamationmark.triangle.fill")
        .foregroundStyle(.red)
      Text(message)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      Spacer(minLength: 0)
    }
    .padding(8)
    .background(Color.red.opacity(0.1))
    .clipShape(RoundedRectangle(cornerRadius: 6))
    .padding(.horizontal)
    .accessibilityIdentifier("helper-log-error-banner")
  }
}

private struct HelperLogEventRow: View {
  let event: HelperEvent
  @State private var isExpanded = false

  private var hasFields: Bool { event.fields?.isEmpty == false }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Button {
        guard hasFields else { return }
        isExpanded.toggle()
      } label: {
        HStack(alignment: .top, spacing: 8) {
          Circle()
            .fill(levelColor)
            .frame(width: 6, height: 6)
            .padding(.top, 5)
          VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
              Text(event.at, style: .time)
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
              Text(event.kind)
                .font(.caption.weight(.medium))
            }
            Text(event.message)
              .font(.callout)
          }
          Spacer()
          if hasFields {
            Image(systemName: "chevron.down")
              .font(.caption2)
              .foregroundStyle(.tertiary)
              .rotationEffect(.degrees(isExpanded ? 180 : 0))
          }
        }
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)

      if isExpanded, let fields = event.fields {
        Text(
          fields.sorted { $0.key < $1.key }
            .map { "\($0.key): \($0.value.displayText)" }
            .joined(separator: "\n")
        )
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 6))
      }
    }
    .padding(.vertical, 2)
    .accessibilityIdentifier("helper-log-event-\(event.seq)")
  }

  private var levelColor: Color {
    switch event.level {
    case "debug": .gray
    case "warn": .yellow
    case "error": .red
    default: .blue
    }
  }
}

private struct HelperLogRawTabView: View {
  let state: HelperLogState

  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Text("日志文件：\(HelperLogPath.filePath)")
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
          .truncationMode(.middle)
        Spacer()
        Button {
          UIPasteboard.general.string = HelperLogPath.filePath
        } label: {
          Image(systemName: "doc.on.doc")
        }
        .accessibilityIdentifier("helper-log-copy-path")
      }
      .padding(.horizontal)

      HStack {
        Spacer()
        Button {
          UIPasteboard.general.string = state.rawText
        } label: {
          Label("复制", systemImage: "doc.on.doc")
        }
        .accessibilityIdentifier("helper-log-copy-raw")
      }
      .padding(.horizontal)

      if let error = state.rawErrorMessage, state.rawText.isEmpty {
        HelperLogErrorNotice(message: error)
      } else {
        if let error = state.rawErrorMessage {
          HelperLogErrorBanner(message: error)
        }
        ScrollView {
          Text(state.rawText.isEmpty ? "暂无日志" : state.rawText)
            .font(.caption.monospaced())
            .foregroundStyle(state.rawText.isEmpty ? .secondary : .primary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal)
        }
        .overlay {
          if state.isLoadingRaw, state.rawText.isEmpty {
            ProgressView()
          }
        }
      }
    }
    .padding(.top, 4)
  }
}
