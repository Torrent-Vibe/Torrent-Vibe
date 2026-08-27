import UIKit

final class TorrentRowCell: UITableViewCell {
  static let reuseIdentifier = "TorrentRowCell"

  private let selectionImageView = UIImageView()
  private let statusImageView = UIImageView()
  private let nameLabel = UILabel()
  private let progressLabel = UILabel()
  private let progressView = UIProgressView(progressViewStyle: .default)
  private let sizeLabel = UILabel()
  private let speedLabel = UILabel()
  private let etaLabel = UILabel()

  override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
    super.init(style: style, reuseIdentifier: reuseIdentifier)
    configureView()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func update(torrent: TorrentSummary, isSelecting: Bool, isMarked: Bool) {
    let statusColor = statusColor(for: torrent.status)
    let speed: String?

    selectionImageView.isHidden = !isSelecting
    selectionImageView.image = UIImage(
      systemName: isMarked ? "checkmark.circle.fill" : "circle"
    )
    selectionImageView.tintColor = isMarked ? tintColor : .secondaryLabel

    statusImageView.image = UIImage(systemName: statusSymbol(for: torrent.status))
    statusImageView.tintColor = statusColor
    nameLabel.text = torrent.name
    progressLabel.text = torrent.progress.formatted(.percent.precision(.fractionLength(0)))
    progressView.progress = Float(torrent.progress)
    progressView.progressTintColor = statusColor
    sizeLabel.text = torrent.size

    switch torrent.status {
    case .downloading:
      speed = torrent.downloadSpeed
      speedLabel.textColor = .systemBlue
      etaLabel.text = torrent.eta
    case .seeding:
      speed = torrent.uploadSpeed
      speedLabel.textColor = .systemGreen
      etaLabel.text = nil
    case .paused, .completed, .queued, .error:
      speed = nil
      etaLabel.text = nil
    }
    speedLabel.text = speed
    speedLabel.isHidden = speed == nil
    etaLabel.isHidden = etaLabel.text == nil

    accessibilityIdentifier = "torrent-row-\(torrent.id)"
    accessibilityLabel = [
      torrent.name,
      torrent.statusTitle,
      torrent.size,
      speed,
      etaLabel.text,
      progressLabel.text,
    ]
    .compactMap { $0 }
    .joined(separator: "，")
    accessibilityValue =
      isSelecting
      ? (isMarked ? String(localized: "已选择") : String(localized: "未选择")) : nil
    accessibilityTraits = isMarked ? [.button, .selected] : .button
  }

  private func configureView() {
    selectionStyle = .default
    isAccessibilityElement = true
    contentView.directionalLayoutMargins = NSDirectionalEdgeInsets(
      top: 9,
      leading: 16,
      bottom: 9,
      trailing: 16
    )

    selectionImageView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(textStyle: .body)
    statusImageView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(textStyle: .body)
    for imageView in [selectionImageView, statusImageView] {
      imageView.contentMode = .scaleAspectFit
      NSLayoutConstraint.activate([
        imageView.widthAnchor.constraint(equalToConstant: 18),
        imageView.heightAnchor.constraint(equalToConstant: 18),
      ])
    }

    nameLabel.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(
      for: .systemFont(ofSize: 15, weight: .semibold)
    )
    nameLabel.adjustsFontForContentSizeCategory = true
    nameLabel.lineBreakMode = .byTruncatingTail
    progressLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(
      for: .monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
    )
    progressLabel.textColor = .secondaryLabel
    progressLabel.adjustsFontForContentSizeCategory = true
    progressLabel.setContentCompressionResistancePriority(.required, for: .horizontal)

    for label in [sizeLabel, speedLabel, etaLabel] {
      label.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(
        for: .monospacedDigitSystemFont(ofSize: 12, weight: .medium)
      )
      label.adjustsFontForContentSizeCategory = true
      label.lineBreakMode = .byTruncatingTail
    }
    sizeLabel.textColor = .tertiaryLabel
    etaLabel.textColor = .secondaryLabel

    let titleRow = UIStackView(arrangedSubviews: [nameLabel, progressLabel])
    titleRow.alignment = .firstBaseline
    titleRow.spacing = 8

    let metadataSpacer = UIView()
    metadataSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
    let metadataRow = UIStackView(arrangedSubviews: [
      sizeLabel, speedLabel, metadataSpacer, etaLabel,
    ])
    metadataRow.alignment = .firstBaseline
    metadataRow.spacing = 6

    let details = UIStackView(arrangedSubviews: [titleRow, progressView, metadataRow])
    details.axis = .vertical
    details.spacing = 5

    let row = UIStackView(arrangedSubviews: [selectionImageView, statusImageView, details])
    row.alignment = .center
    row.spacing = 10
    row.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(row)

    NSLayoutConstraint.activate([
      row.leadingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.leadingAnchor),
      row.trailingAnchor.constraint(equalTo: contentView.layoutMarginsGuide.trailingAnchor),
      row.topAnchor.constraint(equalTo: contentView.layoutMarginsGuide.topAnchor),
      row.bottomAnchor.constraint(equalTo: contentView.layoutMarginsGuide.bottomAnchor),
      progressView.heightAnchor.constraint(equalToConstant: 4),
    ])
  }

  private func statusColor(for status: TorrentStatus) -> UIColor {
    switch status {
    case .downloading: .systemBlue
    case .seeding, .completed: .systemGreen
    case .paused, .queued: .secondaryLabel
    case .error: .systemRed
    }
  }

  private func statusSymbol(for status: TorrentStatus) -> String {
    switch status {
    case .downloading: "arrow.down.circle.fill"
    case .seeding: "arrow.up.circle.fill"
    case .completed: "checkmark.circle.fill"
    case .paused: "pause.circle.fill"
    case .queued: "clock.fill"
    case .error: "exclamationmark.circle.fill"
    }
  }
}
