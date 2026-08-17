import Foundation
@preconcurrency import JavaScriptCore

actor MikanJavaScriptRuntime {
  static let expectedBridgeVersion = 1

  let bridgeVersion: Int

  private let context: JSContext
  private let invokeFunction: JSValue

  init(bundle: Bundle = .main) throws {
    guard let scriptURL = bundle.url(forResource: "MikanParser", withExtension: "js") else {
      throw MikanJavaScriptRuntimeError.missingBundle
    }

    let source = try String(contentsOf: scriptURL, encoding: .utf8)
    guard
      let virtualMachine = JSVirtualMachine(),
      let context = JSContext(virtualMachine: virtualMachine)
    else {
      throw MikanJavaScriptRuntimeError.contextCreationFailed
    }

    context.name = "Torrent Vibe Mikan Parser"
    context.evaluateScript(source, withSourceURL: scriptURL)
    if let exception = context.exception?.toString() {
      throw MikanJavaScriptRuntimeError.scriptEvaluationFailed(exception)
    }

    guard let api = context.objectForKeyedSubscript("MikanParser"), !api.isUndefined else {
      throw MikanJavaScriptRuntimeError.missingBridge
    }

    let bridgeVersion = Int(api.objectForKeyedSubscript("bridgeVersion")?.toInt32() ?? 0)
    guard bridgeVersion == Self.expectedBridgeVersion else {
      throw MikanJavaScriptRuntimeError.unsupportedBridgeVersion(bridgeVersion)
    }
    guard let invokeFunction = api.objectForKeyedSubscript("invoke"), invokeFunction.isObject else {
      throw MikanJavaScriptRuntimeError.missingInvokeFunction
    }

    self.context = context
    self.invokeFunction = invokeFunction
    self.bridgeVersion = bridgeVersion
  }

  func parseSeasonWall(html: String) throws -> MikanSeasonWall {
    try invoke(.seasonWall, input: DocumentInput(html: html))
  }

  func parseSearchBangumi(html: String) throws -> [MikanBangumiCard] {
    try invoke(.searchBangumi, input: DocumentInput(html: html))
  }

  func parseBangumiDetail(
    html: String,
    bangumiId: String,
    baseURL: URL
  ) throws -> MikanBangumiDetail {
    try invoke(
      .bangumiDetail,
      input: BangumiDetailInput(
        bangumiId: bangumiId,
        baseUrl: baseURL.absoluteString,
        html: html
      )
    )
  }

  func parseBangumiRss(xml: String, baseURL: URL) throws -> [MikanRssEpisode] {
    try invoke(
      .bangumiRss,
      input: BangumiRssInput(baseUrl: baseURL.absoluteString, xml: xml)
    )
  }

  func parseTitle(_ title: String) throws -> MikanParsedTitle {
    try invoke(.parseTitle, input: TitleInput(title: title))
  }

  private func invoke<Input: Encodable, Output: Decodable>(
    _ operation: Operation,
    input: Input
  ) throws -> Output {
    let inputData = try JSONEncoder().encode(input)
    guard let inputJSON = String(data: inputData, encoding: .utf8) else {
      throw MikanJavaScriptRuntimeError.invalidInput
    }

    context.exception = nil
    guard
      let result = invokeFunction.call(withArguments: [operation.rawValue, inputJSON]),
      !result.isUndefined,
      let outputJSON = result.toString()
    else {
      if let exception = context.exception?.toString() {
        throw MikanJavaScriptRuntimeError.invocationFailed(exception)
      }
      throw MikanJavaScriptRuntimeError.invalidOutput
    }

    let envelope = try JSONDecoder().decode(
      BridgeEnvelope<Output>.self,
      from: Data(outputJSON.utf8)
    )
    guard envelope.ok, let value = envelope.value else {
      throw MikanJavaScriptRuntimeError.parserFailure(
        envelope.error?.message ?? "Mikan parser returned no value."
      )
    }
    return value
  }
}

enum MikanRuntimeInstallation: Sendable {
  case available(MikanJavaScriptRuntime)
  case unavailable(String)

  var statusText: String {
    switch self {
    case .available:
      "JavaScriptCore Bridge v\(MikanJavaScriptRuntime.expectedBridgeVersion)"
    case .unavailable(let message):
      message
    }
  }
}

extension MikanJavaScriptRuntime {
  fileprivate enum Operation: String {
    case bangumiDetail
    case bangumiRss
    case parseTitle
    case searchBangumi
    case seasonWall
  }

  fileprivate struct DocumentInput: Encodable {
    let html: String
  }

  fileprivate struct BangumiDetailInput: Encodable {
    let bangumiId: String
    let baseUrl: String
    let html: String
  }

  fileprivate struct BangumiRssInput: Encodable {
    let baseUrl: String
    let xml: String
  }

  fileprivate struct TitleInput: Encodable {
    let title: String
  }

  fileprivate struct BridgeEnvelope<Value: Decodable>: Decodable {
    let ok: Bool
    let value: Value?
    let error: BridgeError?
  }

  fileprivate struct BridgeError: Decodable {
    let code: String
    let message: String
  }
}

enum MikanJavaScriptRuntimeError: LocalizedError {
  case contextCreationFailed
  case invalidInput
  case invalidOutput
  case invocationFailed(String)
  case missingBridge
  case missingBundle
  case missingInvokeFunction
  case parserFailure(String)
  case scriptEvaluationFailed(String)
  case unsupportedBridgeVersion(Int)

  var errorDescription: String? {
    switch self {
    case .contextCreationFailed:
      "无法创建 JavaScriptCore 上下文。"
    case .invalidInput:
      "无法编码 Mikan 解析输入。"
    case .invalidOutput:
      "Mikan 解析器没有返回有效结果。"
    case .invocationFailed(let message):
      "JavaScriptCore 调用失败：\(message)"
    case .missingBridge:
      "Mikan JavaScript Bundle 未暴露桥接对象。"
    case .missingBundle:
      "App Bundle 中缺少 MikanParser.js。"
    case .missingInvokeFunction:
      "Mikan JavaScript Bundle 缺少 invoke 函数。"
    case .parserFailure(let message):
      "Mikan 解析失败：\(message)"
    case .scriptEvaluationFailed(let message):
      "Mikan JavaScript Bundle 加载失败：\(message)"
    case .unsupportedBridgeVersion(let version):
      "不支持 Mikan JavaScript Bridge v\(version)。"
    }
  }
}
