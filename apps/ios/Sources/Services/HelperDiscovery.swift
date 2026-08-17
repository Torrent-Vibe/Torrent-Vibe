import Foundation
import Observation

struct DiscoveredHelper: Hashable, Identifiable, Sendable {
  let name: String
  let host: String
  let port: Int
  let version: String

  var id: String { "\(name):\(host):\(port)" }

  var baseURL: URL? {
    var components = URLComponents()
    components.scheme = "http"
    components.host = host
    components.port = port
    return components.url
  }
}

@MainActor
@Observable
final class HelperDiscoveryModel: NSObject, @preconcurrency NetServiceBrowserDelegate,
  @preconcurrency NetServiceDelegate
{
  private(set) var helpers: [DiscoveredHelper]
  private(set) var isSearching = false

  private let demoMode: Bool
  private let browser = NetServiceBrowser()
  private var services: [String: NetService] = [:]

  init(demoMode: Bool) {
    self.demoMode = demoMode
    helpers = []
    super.init()
  }

  func start() {
    guard !isSearching else { return }
    isSearching = true
    if demoMode {
      helpers = [
        DiscoveredHelper(
          name: "家庭 NAS Helper",
          host: "nas.example.test",
          port: 17_890,
          version: "2.0.0"
        )
      ]
      return
    }
    browser.delegate = self
    browser.searchForServices(ofType: "_torrentvibe-helper._tcp.", inDomain: "local.")
  }

  func stop() {
    guard isSearching else { return }
    if !demoMode {
      browser.stop()
    }
    for service in services.values {
      service.stop()
    }
    services.removeAll()
    isSearching = false
  }

  func netServiceBrowser(
    _ browser: NetServiceBrowser,
    didFind service: NetService,
    moreComing: Bool
  ) {
    let key = "\(service.name):\(service.type):\(service.domain)"
    services[key] = service
    service.delegate = self
    service.resolve(withTimeout: 5)
  }

  func netServiceBrowser(
    _ browser: NetServiceBrowser,
    didRemove service: NetService,
    moreComing: Bool
  ) {
    let key = "\(service.name):\(service.type):\(service.domain)"
    services[key] = nil
    helpers.removeAll { $0.name == service.name }
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    guard let rawHost = sender.hostName, sender.port > 0 else { return }
    let host = rawHost.hasSuffix(".") ? String(rawHost.dropLast()) : rawHost
    let version =
      sender.txtRecordData()
      .map(NetService.dictionary(fromTXTRecord:))?["version"]
      .flatMap { String(data: $0, encoding: .utf8) } ?? ""
    let helper = DiscoveredHelper(
      name: sender.name,
      host: host,
      port: sender.port,
      version: version
    )
    helpers.removeAll { $0.name == sender.name }
    helpers.append(helper)
    helpers.sort { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
  }
}
