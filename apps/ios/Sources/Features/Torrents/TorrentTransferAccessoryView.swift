import UIKit

@MainActor
final class TorrentTransferAccessoryView: UIView {
  private let downloadLabel = UILabel()
  private let uploadLabel = UILabel()
  private let metricsStack = UIStackView()

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureView()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var intrinsicContentSize: CGSize {
    let contentSize = metricsStack.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
    return CGSize(width: contentSize.width + 32, height: 44)
  }

  func update(downloadSpeed: String, uploadSpeed: String) {
    downloadLabel.text = downloadSpeed
    uploadLabel.text = uploadSpeed
    accessibilityValue = String(localized: "下载 \(downloadSpeed)，上传 \(uploadSpeed)")
    invalidateIntrinsicContentSize()
  }

  private func configureView() {
    backgroundColor = .clear
    isAccessibilityElement = true
    accessibilityIdentifier = "torrent-transfer-accessory"
    accessibilityLabel = String(localized: "传输速度")
    accessibilityTraits = [.updatesFrequently]

    let downloadMetric = makeMetric(
      systemImage: "arrow.down",
      tintColor: .systemBlue,
      label: downloadLabel
    )
    let uploadMetric = makeMetric(
      systemImage: "arrow.up",
      tintColor: .systemGreen,
      label: uploadLabel
    )

    metricsStack.axis = .horizontal
    metricsStack.alignment = .center
    metricsStack.distribution = .fill
    metricsStack.spacing = 20
    metricsStack.translatesAutoresizingMaskIntoConstraints = false
    metricsStack.addArrangedSubview(downloadMetric)
    metricsStack.addArrangedSubview(uploadMetric)
    addSubview(metricsStack)

    NSLayoutConstraint.activate([
      metricsStack.centerXAnchor.constraint(equalTo: centerXAnchor),
      metricsStack.centerYAnchor.constraint(equalTo: centerYAnchor),
      metricsStack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 16),
      metricsStack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -16),
    ])
  }

  private func makeMetric(
    systemImage: String,
    tintColor: UIColor,
    label: UILabel
  ) -> UIStackView {
    let icon = UIImageView(image: UIImage(systemName: systemImage))
    icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(textStyle: .subheadline)
    icon.tintColor = tintColor
    icon.setContentHuggingPriority(.required, for: .horizontal)

    let baseFont = UIFont.monospacedDigitSystemFont(ofSize: 14, weight: .semibold)
    label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: baseFont)
    label.adjustsFontForContentSizeCategory = true
    label.textColor = .label
    label.numberOfLines = 1
    label.setContentCompressionResistancePriority(.required, for: .horizontal)

    let stack = UIStackView(arrangedSubviews: [icon, label])
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 5
    return stack
  }
}
