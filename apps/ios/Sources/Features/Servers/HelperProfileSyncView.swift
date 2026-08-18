import Observation
import SwiftUI
import UIKit

private enum HelperProfileGroup: String, CaseIterable, Hashable, Identifiable {
  case mteam
  case mikan

  var id: String { rawValue }

  var title: String {
    switch self {
    case .mteam: "M-Team"
    case .mikan: "Mikan 配置"
    }
  }

  func contains(key: String) -> Bool {
    key.hasPrefix("discover.\(rawValue).")
  }
}

@MainActor
@Observable
private final class HelperProfileSyncState {
  var errorMessage: String?
  var isLoading = false
  var isWorking = false
  var localRecords: [HelperProfileRecord] = []
  var notice: String?
  var remote: HelperProfileSnapshot?
  var selectedGroups = Set(HelperProfileGroup.allCases)

  private let credentialStore: any MTeamCredentialStore
  private let defaults: UserDefaults
  private let model: AppModel
  private let serverID: UUID

  init(
    model: AppModel,
    serverID: UUID,
    defaults: UserDefaults = .standard,
    credentialStore: any MTeamCredentialStore = KeychainMTeamCredentialStore()
  ) {
    self.model = model
    self.serverID = serverID
    self.defaults = defaults
    self.credentialStore = credentialStore
  }

  func load() async {
    isLoading = true
    errorMessage = nil
    defer { isLoading = false }
    do {
      async let profile = model.helperProfile(for: serverID)
      localRecords = try collectLocalRecords()
      remote = try await profile
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func setSelected(_ selected: Bool, for group: HelperProfileGroup) {
    if selected {
      selectedGroups.insert(group)
    } else {
      selectedGroups.remove(group)
    }
  }

  func localCount(for group: HelperProfileGroup) -> Int {
    localRecords.count { group.contains(key: $0.key) }
  }

  func remoteCount(for group: HelperProfileGroup) -> Int {
    remote?.records.count { group.contains(key: $0.key) } ?? 0
  }

  func upload() async {
    guard let remote else { return }
    let records = localRecords.filter(recordIsSelected)
    guard !records.isEmpty else { return }
    isWorking = true
    errorMessage = nil
    notice = nil
    defer { isWorking = false }
    let mutations = records.map {
      HelperProfileMutation.set(key: $0.key, value: $0.value, secret: $0.secret)
    }
    do {
      do {
        self.remote = try await model.updateHelperProfile(
          for: serverID,
          revision: remote.revision,
          mutations: mutations
        )
      } catch HelperServiceError.profileRevisionConflict(let latest) {
        self.remote = try await model.updateHelperProfile(
          for: serverID,
          revision: latest.revision,
          mutations: mutations
        )
      }
      notice = "已上传 \(records.count) 项配置；未选择的项目保持不变。"
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  func pull() async {
    guard let remote else { return }
    let records = remote.records.filter(recordIsSelected)
    guard !records.isEmpty else { return }
    isWorking = true
    errorMessage = nil
    notice = nil
    defer { isWorking = false }
    do {
      let applied = try apply(records: records)
      localRecords = try collectLocalRecords()
      notice = "已拉取并应用 \(applied) 项配置；未选择的项目保持不变。"
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private func recordIsSelected(_ record: HelperProfileRecord) -> Bool {
    selectedGroups.contains { $0.contains(key: record.key) }
  }

  private func collectLocalRecords() throws -> [HelperProfileRecord] {
    let storedMTeamPageSize = defaults.integer(forKey: "discover.mteam.pageSize")
    var records = [
      localRecord(
        key: "discover.mteam.enabled",
        value: String(defaults.bool(forKey: "discover.mteam.enabled"))
      ),
      localRecord(
        key: "discover.mteam.baseUrl",
        value: defaults.string(forKey: "discover.mteam.baseURL")
          ?? "https://api.m-team.cc/api"
      ),
      localRecord(
        key: "discover.mteam.mode",
        value: defaults.string(forKey: "discover.mteam.mode") ?? "normal"
      ),
      localRecord(
        key: "discover.mteam.pageSize",
        value: String(storedMTeamPageSize == 0 ? 20 : storedMTeamPageSize)
      ),
      localRecord(
        key: "discover.mikan.enabled",
        value: String(
          defaults.object(forKey: "discover.mikan.enabled") == nil
            || defaults.bool(forKey: "discover.mikan.enabled")
        )
      ),
      localRecord(
        key: "discover.mikan.baseUrl",
        value: defaults.string(forKey: "discover.mikan.baseURL") ?? "https://mikanani.me"
      ),
    ]
    if let apiKey = try credentialStore.apiKey()?.trimmingCharacters(
      in: .whitespacesAndNewlines),
      !apiKey.isEmpty
    {
      records.append(
        localRecord(key: "discover.mteam.apiKey", value: apiKey, secret: true)
      )
    }
    return records
  }

  private func localRecord(
    key: String,
    value: String,
    secret: Bool = false
  ) -> HelperProfileRecord {
    HelperProfileRecord(
      key: key,
      value: value,
      secret: secret,
      updatedAt: "",
      updatedBy: ""
    )
  }

  private func apply(records: [HelperProfileRecord]) throws -> Int {
    var applied = 0
    for record in records {
      switch record.key {
      case "discover.mteam.enabled":
        guard let value = Bool(record.value) else { continue }
        defaults.set(value, forKey: "discover.mteam.enabled")
      case "discover.mteam.baseUrl":
        defaults.set(record.value, forKey: "discover.mteam.baseURL")
      case "discover.mteam.mode":
        defaults.set(record.value, forKey: "discover.mteam.mode")
      case "discover.mteam.pageSize":
        guard let value = Int(record.value), (1...100).contains(value) else { continue }
        defaults.set(value, forKey: "discover.mteam.pageSize")
      case "discover.mteam.apiKey":
        try credentialStore.setAPIKey(record.value)
      case "discover.mikan.enabled":
        guard let value = Bool(record.value) else { continue }
        defaults.set(value, forKey: "discover.mikan.enabled")
      case "discover.mikan.baseUrl":
        defaults.set(record.value, forKey: "discover.mikan.baseURL")
      default:
        continue
      }
      applied += 1
    }
    return applied
  }
}

final class HelperProfileSyncViewController: SwiftUIHostingViewController {
  private let state: HelperProfileSyncState

  init(model: AppModel, serverID: UUID) {
    state = HelperProfileSyncState(model: model, serverID: serverID)
    super.init(nibName: nil, bundle: nil)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    title = "凭证同步"
    navigationItem.largeTitleDisplayMode = .never
    view.backgroundColor = .systemGroupedBackground
    host(HelperProfileSyncContentView(state: state))
  }
}

private struct HelperProfileSyncContentView: View {
  @State private var confirmsPull = false
  @State private var confirmsUpload = false
  let state: HelperProfileSyncState

  var body: some View {
    Form {
      if state.isLoading, state.remote == nil {
        Section {
          HStack(spacing: 12) {
            ProgressView()
            Text("正在读取本机与 Helper 配置")
          }
        }
      } else {
        Section {
          ForEach(HelperProfileGroup.allCases) { group in
            Toggle(
              isOn: Binding(
                get: { state.selectedGroups.contains(group) },
                set: { state.setSelected($0, for: group) }
              )
            ) {
              VStack(alignment: .leading, spacing: 3) {
                Text(group.title)
                Text(
                  "本机 \(state.localCount(for: group)) 项 · "
                    + "Helper \(state.remoteCount(for: group)) 项"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
              }
            }
            .accessibilityIdentifier("helper-profile-group-\(group.rawValue)")
          }
        } header: {
          Text("同步项目")
        } footer: {
          Text("未选择的项目不会上传、拉取或删除。iOS 当前应用 M-Team 与 Mikan 配置；Helper 中其他凭证保持不变。")
        }

        Section {
          Button("上传凭证到 Helper") {
            confirmsUpload = true
          }
          .disabled(state.isWorking || state.remote == nil || state.selectedGroups.isEmpty)
          .accessibilityIdentifier("helper-profile-upload")

          Button("从 Helper 拉取凭证") {
            confirmsPull = true
          }
          .disabled(state.isWorking || state.remote == nil || state.selectedGroups.isEmpty)
          .accessibilityIdentifier("helper-profile-pull")
        } footer: {
          Text("操作前会再次确认。来源端已存在的所选项目会覆盖目标端对应值。")
        }
      }

      if state.isWorking {
        Section {
          HStack(spacing: 12) {
            ProgressView()
            Text("正在同步")
          }
        }
      } else if let errorMessage = state.errorMessage {
        Section("同步失败") {
          Label(errorMessage, systemImage: "exclamationmark.triangle")
            .foregroundStyle(.orange)
        }
      } else if let notice = state.notice {
        Section("同步完成") {
          Label(notice, systemImage: "checkmark.circle")
            .foregroundStyle(.green)
        }
      }
    }
    .task {
      if state.remote == nil {
        await state.load()
      }
    }
    .alert("上传凭证到 Helper？", isPresented: $confirmsUpload) {
      Button("取消", role: .cancel) {}
      Button("上传") {
        Task { await state.upload() }
      }
    } message: {
      Text("本机已存在的所选项目将覆盖 Helper 对应值；未选择的项目保持不变。")
    }
    .alert("从 Helper 拉取凭证？", isPresented: $confirmsPull) {
      Button("取消", role: .cancel) {}
      Button("拉取") {
        Task { await state.pull() }
      }
    } message: {
      Text("Helper 中已存在的所选项目将覆盖本机对应值；未选择的项目保持不变。")
    }
  }
}
