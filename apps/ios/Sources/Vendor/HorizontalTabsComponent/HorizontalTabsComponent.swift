import Foundation
import UIKit

// Adapted from Telegram-iOS's HorizontalTabsComponent at commit
// 6ad963e5b62d354da79040f388ae2b9132fb17b8. Telegram-specific ComponentFlow,
// presentation, text-entity, and context-controller types are replaced with UIKit equivalents;
// the layout, selection, interactive switching, editing, reordering, and animation behavior remain
// available to this application as a standalone component. Selection uses a plain system fill
// instead of Telegram's Liquid Lens rendering.

private final class HorizontalTabsReorderingTimerTarget: NSObject {
  private let action: () -> Void

  init(action: @escaping () -> Void) {
    self.action = action
    super.init()
  }

  @objc func timerEvent() {
    action()
  }
}

private final class HorizontalTabsGestureDelegate: NSObject, UIGestureRecognizerDelegate {
  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    otherGestureRecognizer is UIPanGestureRecognizer
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldReceive touch: UITouch
  ) -> Bool {
    !(touch.view is UIControl)
  }
}

private final class HorizontalTabsReorderingGestureRecognizer: UIGestureRecognizer {
  private let internalDelegate = HorizontalTabsGestureDelegate()
  private let shouldBeginAtPoint: (CGPoint) -> Bool
  private let began: (CGPoint) -> Void
  private let ended: () -> Void
  private let moved: (CGFloat) -> Void

  private var initialLocation: CGPoint?
  private var delayTimer: Timer?

  private(set) var currentLocation: CGPoint?

  init(
    shouldBegin: @escaping (CGPoint) -> Bool,
    began: @escaping (CGPoint) -> Void,
    ended: @escaping () -> Void,
    moved: @escaping (CGFloat) -> Void
  ) {
    self.shouldBeginAtPoint = shouldBegin
    self.began = began
    self.ended = ended
    self.moved = moved
    super.init(target: nil, action: nil)
    delegate = internalDelegate
  }

  override func reset() {
    super.reset()
    initialLocation = nil
    delayTimer?.invalidate()
    delayTimer = nil
    currentLocation = nil
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesBegan(touches, with: event)

    guard state == .possible, let location = touches.first?.location(in: view) else {
      state = .failed
      return
    }
    guard delayTimer == nil, shouldBeginAtPoint(location) else {
      state = .failed
      return
    }

    initialLocation = location
    let timer = Timer(
      timeInterval: 0.2,
      target: HorizontalTabsReorderingTimerTarget { [weak self] in
        guard let self else { return }
        delayTimer = nil
        state = .began
        began(location)
      },
      selector: #selector(HorizontalTabsReorderingTimerTarget.timerEvent),
      userInfo: nil,
      repeats: false
    )
    delayTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesEnded(touches, with: event)
    delayTimer?.invalidate()
    if state == .began || state == .changed {
      ended()
    }
    state = .failed
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesCancelled(touches, with: event)
    delayTimer?.invalidate()
    if state == .began || state == .changed {
      ended()
    }
    state = .failed
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    super.touchesMoved(touches, with: event)

    guard
      let initialLocation,
      let location = touches.first?.location(in: view)
    else { return }

    let offset = location.x - initialLocation.x
    currentLocation = location

    if delayTimer != nil {
      if abs(offset) > 4.0 {
        delayTimer?.invalidate()
        delayTimer = nil
        state = .failed
      }
    } else if state == .began || state == .changed {
      state = .changed
      moved(offset)
    }
  }
}

@MainActor
public final class HorizontalTabsComponent {
  public struct Theme {
    public let selectedSegmentBackgroundColor: UIColor
    public let selectedTextColor: UIColor
    public let unselectedTextColor: UIColor
    public let selectedBadgeBackgroundColor: UIColor
    public let unselectedBadgeBackgroundColor: UIColor
    public let selectedBadgeForegroundColor: UIColor
    public let unselectedBadgeForegroundColor: UIColor

    public init(
      selectedSegmentBackgroundColor: UIColor,
      selectedTextColor: UIColor,
      unselectedTextColor: UIColor,
      selectedBadgeBackgroundColor: UIColor,
      unselectedBadgeBackgroundColor: UIColor,
      selectedBadgeForegroundColor: UIColor,
      unselectedBadgeForegroundColor: UIColor
    ) {
      self.selectedSegmentBackgroundColor = selectedSegmentBackgroundColor
      self.selectedTextColor = selectedTextColor
      self.unselectedTextColor = unselectedTextColor
      self.selectedBadgeBackgroundColor = selectedBadgeBackgroundColor
      self.unselectedBadgeBackgroundColor = unselectedBadgeBackgroundColor
      self.selectedBadgeForegroundColor = selectedBadgeForegroundColor
      self.unselectedBadgeForegroundColor = unselectedBadgeForegroundColor
    }

    @MainActor public static let system = Theme(
      selectedSegmentBackgroundColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? .secondarySystemFill : .systemBackground
      },
      selectedTextColor: .label,
      unselectedTextColor: .secondaryLabel,
      selectedBadgeBackgroundColor: .clear,
      unselectedBadgeBackgroundColor: .clear,
      selectedBadgeForegroundColor: .secondaryLabel,
      unselectedBadgeForegroundColor: .tertiaryLabel
    )
  }

  public final class Tab: Equatable {
    public typealias Id = AnyHashable

    public struct Badge: Equatable {
      public let title: String

      public init(title: String) {
        self.title = title
      }
    }

    public struct Title: Equatable {
      public let text: String
      public let enableAnimations: Bool

      public init(text: String, enableAnimations: Bool = true) {
        self.text = text
        self.enableAnimations = enableAnimations
      }
    }

    public final class CustomContent: Equatable {
      public let id: AnyHashable
      fileprivate let makeView: () -> UIView
      fileprivate let updateView: (UIView, Bool, CGSize) -> CGSize

      public init(
        id: AnyHashable,
        makeView: @escaping () -> UIView,
        update: @escaping (UIView, Bool, CGSize) -> CGSize
      ) {
        self.id = id
        self.makeView = makeView
        self.updateView = update
      }

      public static func == (lhs: CustomContent, rhs: CustomContent) -> Bool {
        lhs.id == rhs.id
      }
    }

    public enum Content: Equatable {
      case title(Title)
      case custom(CustomContent)
    }

    public typealias ContextAction = (UIView) -> UIContextMenuConfiguration?

    public let id: Id
    public let content: Content
    public let badge: Badge?
    public let accessibilityLabel: String?
    public let accessibilityIdentifier: String?
    public let isEditable: Bool
    public let action: () -> Void
    public let contextAction: ContextAction?
    public let deleteAction: (() -> Void)?

    public init(
      id: Id,
      content: Content,
      badge: Badge?,
      accessibilityLabel: String? = nil,
      accessibilityIdentifier: String? = nil,
      isEditable: Bool = true,
      action: @escaping () -> Void,
      contextAction: ContextAction? = nil,
      deleteAction: (() -> Void)? = nil
    ) {
      self.id = id
      self.content = content
      self.badge = badge
      self.accessibilityLabel = accessibilityLabel
      self.accessibilityIdentifier = accessibilityIdentifier
      self.isEditable = isEditable
      self.action = action
      self.contextAction = contextAction
      self.deleteAction = deleteAction
    }

    public static func == (lhs: Tab, rhs: Tab) -> Bool {
      lhs.id == rhs.id
        && lhs.content == rhs.content
        && lhs.badge == rhs.badge
        && lhs.accessibilityLabel == rhs.accessibilityLabel
        && lhs.accessibilityIdentifier == rhs.accessibilityIdentifier
        && lhs.isEditable == rhs.isEditable
        && (lhs.contextAction == nil) == (rhs.contextAction == nil)
        && (lhs.deleteAction == nil) == (rhs.deleteAction == nil)
    }
  }

  public enum Layout {
    case fit
    case fill
  }

  public let theme: Theme
  public let tabs: [Tab]
  public let selectedTab: Tab.Id?
  public let isEditing: Bool
  public let layout: Layout
  public let liftWhileSwitching: Bool
  public let verticalInset: CGFloat
  public let reorderAction: (([Tab.Id]) -> Void)?

  public init(
    theme: Theme = .system,
    tabs: [Tab],
    selectedTab: Tab.Id?,
    isEditing: Bool,
    layout: Layout = .fill,
    liftWhileSwitching: Bool = true,
    verticalInset: CGFloat = 3.0,
    reorderAction: (([Tab.Id]) -> Void)? = nil
  ) {
    self.theme = theme
    self.tabs = tabs
    self.selectedTab = selectedTab
    self.isEditing = isEditing
    self.layout = layout
    self.liftWhileSwitching = liftWhileSwitching
    self.verticalInset = verticalInset
    self.reorderAction = reorderAction
  }

  private final class ScrollView: UIScrollView {
    override func touchesShouldCancel(in view: UIView) -> Bool {
      true
    }
  }

  private struct LayoutData {
    var size: CGSize
    var selectedItemFrame: CGRect
  }

  @MainActor
  private final class ItemView {
    var frame = CGRect.zero
    var selectionFrame = CGRect.zero
    let regularView = HorizontalTabItemView()
    let selectedView = HorizontalTabItemView()
  }

  public final class View: UIView, UIScrollViewDelegate, UIGestureRecognizerDelegate {
    private let contentClipView = UIView()
    private let scrollView = ScrollView()
    private let selectionView = UIView()
    private let selectedScrollView = UIView()
    private var itemViews: [Tab.Id: ItemView] = [:]

    private var component: HorizontalTabsComponent?
    private var layoutData: LayoutData?
    private var lastLayoutSize = CGSize.zero
    private var pendingTransition = ComponentTransition.immediate
    private var ignoreScrolling = false

    private var tabSwitchFraction: CGFloat = 0.0
    private var isDraggingTabs = false

    private let tapRecognizer = UITapGestureRecognizer()
    private let tapGestureDelegate = HorizontalTabsGestureDelegate()
    private var reorderingGesture: HorizontalTabsReorderingGestureRecognizer?
    private var reorderingItem: Tab.Id?
    private var reorderingItemPosition: (initial: CGFloat, offset: CGFloat)?
    private var reorderingAutoScrollLink: SharedDisplayLinkDriver.Link?
    private var initialReorderedItemIds: [Tab.Id]?
    public private(set) var reorderedItemIds: [Tab.Id]?

    public override init(frame: CGRect) {
      super.init(frame: frame)

      scrollView.delaysContentTouches = false
      scrollView.canCancelContentTouches = true
      scrollView.contentInsetAdjustmentBehavior = .never
      scrollView.automaticallyAdjustsScrollIndicatorInsets = false
      scrollView.showsVerticalScrollIndicator = false
      scrollView.showsHorizontalScrollIndicator = false
      scrollView.alwaysBounceHorizontal = false
      scrollView.alwaysBounceVertical = false
      scrollView.scrollsToTop = false
      scrollView.clipsToBounds = false
      scrollView.delegate = self

      contentClipView.clipsToBounds = false

      selectionView.clipsToBounds = true
      selectionView.isUserInteractionEnabled = false
      selectionView.accessibilityElementsHidden = true

      selectedScrollView.clipsToBounds = true
      selectedScrollView.isUserInteractionEnabled = false
      selectedScrollView.accessibilityElementsHidden = true

      addSubview(contentClipView)
      contentClipView.addSubview(scrollView)
      contentClipView.addSubview(selectionView)
      selectionView.addSubview(selectedScrollView)

      tapRecognizer.addTarget(self, action: #selector(onTapGesture(_:)))
      tapRecognizer.delegate = tapGestureDelegate
      addGestureRecognizer(tapRecognizer)

      configureReorderingGesture()
      registerForTraitChanges([UITraitUserInterfaceStyle.self]) {
        (view: View, _: UITraitCollection) in
        view.pendingTransition = .immediate
        view.setNeedsLayout()
      }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
      fatalError("init(coder:) has not been implemented")
    }

    public override func layoutSubviews() {
      super.layoutSubviews()
      guard bounds.width > 0.0, bounds.height > 0.0 else { return }
      guard
        bounds.size != lastLayoutSize || layoutData == nil
          || !pendingTransition.animation.isImmediate
      else { return }

      let transition = normalizedTransition(pendingTransition)
      pendingTransition = .immediate
      lastLayoutSize = bounds.size
      layoutItems(availableSize: bounds.size, transition: transition)
    }

    public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
      if let hit = scrollView.hitTest(convert(point, to: scrollView), with: event) {
        return hit
      }
      return super.hitTest(point, with: event)
    }

    public func setOverlayContainerView(_ overlayContainerView: UIView) {
      _ = overlayContainerView
    }

    public func update(
      component: HorizontalTabsComponent,
      transition requestedTransition: ComponentTransition
    ) {
      let previousComponent = self.component
      var shouldFocusOnSelectedTab = isDraggingTabs

      if component.isEditing {
        if reorderedItemIds == nil {
          reorderedItemIds = component.tabs.map(\.id)
        }
      } else {
        reorderedItemIds = nil
      }

      if previousComponent?.selectedTab != component.selectedTab {
        tabSwitchFraction = 0.0
        isDraggingTabs = false
        shouldFocusOnSelectedTab = true
      }

      self.component = component
      selectionView.backgroundColor = component.theme.selectedSegmentBackgroundColor
      reorderingGesture?.isEnabled = component.isEditing

      pendingTransition = normalizedTransition(requestedTransition)
      if bounds.width > 0.0, bounds.height > 0.0 {
        layoutItems(
          availableSize: bounds.size,
          transition: pendingTransition,
          focusOnSelectedTab: shouldFocusOnSelectedTab
        )
        pendingTransition = .immediate
        lastLayoutSize = bounds.size
      } else {
        setNeedsLayout()
      }
    }

    public func updateTabSwitchFraction(
      fraction: CGFloat,
      isDragging: Bool,
      transition: ComponentTransition
    ) {
      tabSwitchFraction = -min(1.0, max(-1.0, fraction))
      isDraggingTabs = isDragging
      guard bounds.width > 0.0, bounds.height > 0.0 else { return }
      layoutItems(
        availableSize: bounds.size,
        transition: normalizedTransition(transition),
        focusOnSelectedTab: true
      )
    }

    public func scrollViewDidScroll(_ scrollView: UIScrollView) {
      guard !ignoreScrolling else { return }
      updateScrolling(transition: .immediate)
    }

    private func configureReorderingGesture() {
      let gesture = HorizontalTabsReorderingGestureRecognizer(
        shouldBegin: { [weak self] point in
          guard let self, let component, component.isEditing else { return false }
          return itemViews.contains { id, itemView in
            guard
              component.tabs.first(where: { $0.id == id })?.isEditable == true,
              let superview = itemView.regularView.superview
            else { return false }
            return superview.convert(itemView.regularView.frame, to: self).contains(point)
          }
        },
        began: { [weak self] point in
          self?.beginReordering(at: point)
        },
        ended: { [weak self] in
          self?.endReordering()
        },
        moved: { [weak self] offset in
          self?.moveReorderingItem(offset: offset)
        }
      )
      reorderingGesture = gesture
      gesture.isEnabled = false
      addGestureRecognizer(gesture)
    }

    private func beginReordering(at point: CGPoint) {
      guard let component else { return }
      initialReorderedItemIds = reorderedItemIds

      for (id, itemView) in itemViews {
        guard
          component.tabs.first(where: { $0.id == id })?.isEditable == true,
          let regularSuperview = itemView.regularView.superview,
          let selectedSuperview = itemView.selectedView.superview
        else { continue }

        let itemFrame = regularSuperview.convert(itemView.regularView.frame, to: self)
        guard itemFrame.contains(point) else { continue }

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        reorderingItem = id
        itemView.regularView.frame = itemFrame
        itemView.selectedView.frame = selectedSuperview.convert(
          itemView.selectedView.frame, to: self)
        addSubview(itemView.regularView)
        addSubview(itemView.selectedView)
        reorderingItemPosition = (itemFrame.minX, 0.0)

        reorderingAutoScrollLink = SharedDisplayLinkDriver.shared.add { [weak self] _ in
          self?.updateReorderingAutoScroll()
        }
        reorderingAutoScrollLink?.isPaused = false
        layoutItems(
          availableSize: bounds.size, transition: normalizedTransition(.easeInOut(duration: 0.25)))
        return
      }
    }

    private func endReordering() {
      guard let reorderingItem else { return }

      if let itemView = itemViews[reorderingItem] {
        let regularFrame = convert(itemView.regularView.frame, to: scrollView)
        let selectedFrame = convert(itemView.selectedView.frame, to: selectedScrollView)
        itemView.regularView.frame = regularFrame
        itemView.selectedView.frame = selectedFrame
        scrollView.addSubview(itemView.regularView)
        selectedScrollView.addSubview(itemView.selectedView)
      }

      self.reorderingItem = nil
      reorderingItemPosition = nil
      reorderingAutoScrollLink?.invalidate()
      reorderingAutoScrollLink = nil

      let reorderedIds = reorderedItemIds
      layoutItems(
        availableSize: bounds.size, transition: normalizedTransition(.easeInOut(duration: 0.25)))
      if let reorderedIds, reorderedIds != initialReorderedItemIds {
        component?.reorderAction?(reorderedIds)
      }
      initialReorderedItemIds = nil
    }

    private func moveReorderingItem(offset: CGFloat) {
      guard
        let reorderingItem,
        let reorderingItemView = itemViews[reorderingItem],
        let initial = reorderingItemPosition?.initial,
        let reorderedItemIds,
        let currentItemIndex = reorderedItemIds.firstIndex(of: reorderingItem)
      else { return }

      reorderingItemPosition = (initial, offset)
      reorderingItemView.regularView.frame.origin.x = initial + offset
      reorderingItemView.selectedView.frame.origin.x = initial + offset

      for (id, otherItemView) in itemViews where id != reorderingItem {
        guard
          let itemIndex = reorderedItemIds.firstIndex(of: id),
          let otherSuperview = otherItemView.regularView.superview
        else { continue }

        let otherFrame = otherSuperview.convert(otherItemView.regularView.frame, to: self)
        guard reorderingItemView.regularView.frame.intersects(otherFrame) else { continue }

        let targetIndex: Int
        if reorderingItemView.regularView.frame.midX < otherFrame.midX {
          targetIndex = max(0, itemIndex - 1)
        } else {
          targetIndex = max(0, min(reorderedItemIds.count - 1, itemIndex))
        }
        guard targetIndex != currentItemIndex else { break }

        UISelectionFeedbackGenerator().selectionChanged()
        var updatedIds = reorderedItemIds
        if targetIndex > currentItemIndex {
          updatedIds.insert(reorderingItem, at: targetIndex + 1)
          updatedIds.remove(at: currentItemIndex)
        } else {
          updatedIds.remove(at: currentItemIndex)
          updatedIds.insert(reorderingItem, at: targetIndex)
        }
        self.reorderedItemIds = updatedIds
        layoutItems(
          availableSize: bounds.size,
          transition: normalizedTransition(.easeInOut(duration: 0.25))
        )
        break
      }
    }

    private func updateReorderingAutoScroll() {
      guard let currentLocation = reorderingGesture?.currentLocation else { return }
      let edgeWidth: CGFloat = 20.0
      var contentOffset = scrollView.contentOffset

      if currentLocation.x <= edgeWidth {
        contentOffset.x = max(0.0, contentOffset.x - 3.0)
      } else if currentLocation.x >= bounds.width - edgeWidth {
        contentOffset.x = min(
          max(0.0, scrollView.contentSize.width - scrollView.bounds.width),
          contentOffset.x + 3.0
        )
      } else {
        return
      }
      scrollView.setContentOffset(contentOffset, animated: false)
    }

    @objc private func onTapGesture(_ recognizer: UITapGestureRecognizer) {
      guard recognizer.state == .ended, let component else { return }
      let point = recognizer.location(in: self)

      for (id, itemView) in itemViews {
        guard scrollView.convert(itemView.selectionFrame, to: self).contains(point) else {
          continue
        }
        guard let tab = component.tabs.first(where: { $0.id == id }) else { return }
        tab.action()
        return
      }
    }

    private func layoutItems(
      availableSize: CGSize,
      transition: ComponentTransition,
      focusOnSelectedTab explicitFocus: Bool? = nil
    ) {
      guard let component, availableSize.width > 0.0, availableSize.height > 0.0 else {
        return
      }

      var orderedTabs = component.tabs
      if let reorderedItemIds {
        orderedTabs = reorderedItemIds.compactMap { id in
          component.tabs.first(where: { $0.id == id })
        }
        for tab in component.tabs where !orderedTabs.contains(where: { $0.id == tab.id }) {
          orderedTabs.append(tab)
        }
      }

      var validIds = Set<Tab.Id>()
      var items: [(tab: Tab, itemView: ItemView, size: CGSize, isNew: Bool)] = []
      let contentHeight = availableSize.height - component.verticalInset * 2.0

      for tab in orderedTabs {
        validIds.insert(tab.id)
        let itemView: ItemView
        let isNew: Bool
        if let current = itemViews[tab.id] {
          itemView = current
          isNew = false
        } else {
          itemView = ItemView()
          itemViews[tab.id] = itemView
          isNew = true
        }

        let itemSize = itemView.regularView.update(
          tab: tab,
          theme: component.theme,
          isSelected: false,
          isAccessibilitySelected: tab.id == component.selectedTab,
          isEditing: component.isEditing,
          availableSize: CGSize(width: 1000.0, height: contentHeight),
          transition: isNew ? .immediate : transition
        )
        _ = itemView.selectedView.update(
          tab: tab,
          theme: component.theme,
          isSelected: true,
          isAccessibilitySelected: tab.id == component.selectedTab,
          isEditing: component.isEditing,
          availableSize: CGSize(width: 1000.0, height: contentHeight),
          transition: isNew ? .immediate : transition
        )
        items.append((tab, itemView, itemSize, isNew))
      }

      let totalContentWidth = items.reduce(CGFloat.zero) { $0 + $1.size.width }
      let scrollContentWidth: CGFloat

      if component.layout == .fill, totalContentWidth < availableSize.width {
        let usableWidth = availableSize.width - 6.0
        let regularItemWidth = floor(usableWidth / CGFloat(max(1, items.count)))
        let lastItemWidth = usableWidth - regularItemWidth * CGFloat(max(0, items.count - 1))

        for index in items.indices {
          let item = items[index]
          let itemWidth = index == items.count - 1 ? lastItemWidth : regularItemWidth
          var itemFrame = CGRect(
            x: regularItemWidth * CGFloat(index) + floor((itemWidth - item.size.width) * 0.5),
            y: 0.0,
            width: item.size.width,
            height: item.size.height
          )
          if item.tab.id == reorderingItem, let position = reorderingItemPosition {
            itemFrame.origin = CGPoint(x: position.initial + position.offset, y: 3.0)
          }
          item.itemView.frame = itemFrame
          item.itemView.selectionFrame = CGRect(
            x: regularItemWidth * CGFloat(index),
            y: 0.0,
            width: itemWidth,
            height: item.size.height
          )
        }
        scrollContentWidth = usableWidth
      } else {
        var contentWidth: CGFloat = 0.0
        for item in items {
          var itemFrame = CGRect(origin: CGPoint(x: contentWidth - 3.0, y: 0.0), size: item.size)
          if item.tab.id == reorderingItem, let position = reorderingItemPosition {
            itemFrame.origin = CGPoint(x: position.initial + position.offset, y: 3.0)
          }
          item.itemView.frame = itemFrame
          item.itemView.selectionFrame = itemFrame
          item.itemView.selectionFrame.size.width += 3.0
          contentWidth += item.size.width
        }
        scrollContentWidth = contentWidth
      }

      for item in items {
        let regularView = item.itemView.regularView
        let selectedView = item.itemView.selectedView
        if regularView.superview == nil {
          scrollView.addSubview(regularView)
          selectedScrollView.addSubview(selectedView)
          if !transition.animation.isImmediate {
            regularView.alpha = 0.0
            regularView.transform = CGAffineTransform(scaleX: 0.001, y: 0.001)
            selectedView.alpha = 0.0
            selectedView.transform = CGAffineTransform(scaleX: 0.001, y: 0.001)
            transition.animateView {
              regularView.alpha = 1.0
              regularView.transform = .identity
              selectedView.alpha = 1.0
              selectedView.transform = .identity
            }
          }
        }

        transition.setFrame(view: regularView, frame: item.itemView.frame)
        transition.setFrame(view: selectedView, frame: item.itemView.frame)
        let isReordering = item.tab.id == reorderingItem
        transition.animateView {
          regularView.transform =
            isReordering
            ? CGAffineTransform(scaleX: 1.2, y: 1.2)
            : .identity
          selectedView.transform =
            isReordering
            ? CGAffineTransform(scaleX: 1.2, y: 1.2)
            : .identity
          regularView.alpha = isReordering ? 0.9 : 1.0
          selectedView.alpha = isReordering ? 0.0 : 1.0
        }
      }

      for (id, itemView) in itemViews where !validIds.contains(id) {
        itemViews.removeValue(forKey: id)
        transition.animateView {
          itemView.regularView.alpha = 0.0
          itemView.regularView.transform = CGAffineTransform(scaleX: 0.001, y: 0.001)
          itemView.selectedView.alpha = 0.0
          itemView.selectedView.transform = CGAffineTransform(scaleX: 0.001, y: 0.001)
        }
        let duration = transition.animation.isImmediate ? 0.0 : 0.5
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
          itemView.regularView.removeFromSuperview()
          itemView.selectedView.removeFromSuperview()
        }
      }

      var selectedItemFrame = CGRect.zero
      if let selectedTab = component.selectedTab,
        let selectedIndex = component.tabs.firstIndex(where: { $0.id == selectedTab }),
        let selectedItemView = itemViews[selectedTab]
      {
        selectedItemFrame = selectedItemView.selectionFrame
        if selectedTab == reorderingItem, let superview = selectedItemView.regularView.superview {
          selectedItemFrame = superview.convert(selectedItemView.selectionFrame, to: scrollView)
        }

        var pendingItemFrame: CGRect?
        if tabSwitchFraction > 0.0, selectedIndex < component.tabs.count - 1 {
          pendingItemFrame = itemViews[component.tabs[selectedIndex + 1].id]?.selectionFrame
        } else if tabSwitchFraction < 0.0, selectedIndex > 0 {
          pendingItemFrame = itemViews[component.tabs[selectedIndex - 1].id]?.selectionFrame
        }
        if let pendingItemFrame {
          let fraction = abs(tabSwitchFraction)
          selectedItemFrame.origin.x =
            selectedItemFrame.minX * (1.0 - fraction)
            + pendingItemFrame.minX * fraction
          selectedItemFrame.size.width =
            selectedItemFrame.width * (1.0 - fraction)
            + pendingItemFrame.width * fraction
        }
      }

      let contentSize = CGSize(width: scrollContentWidth, height: contentHeight)
      let sizeWidth: CGFloat =
        component.layout == .fill
        ? availableSize.width
        : min(availableSize.width, scrollContentWidth + 6.0)
      let size = CGSize(width: sizeWidth, height: availableSize.height)
      layoutData = LayoutData(size: size, selectedItemFrame: selectedItemFrame)

      ignoreScrolling = true
      let scrollViewFrame = CGRect(origin: .zero, size: CGSize(width: size.width - 6.0, height: contentHeight))
      transition.setPosition(
        view: scrollView,
        position: CGPoint(x: scrollViewFrame.midX, y: scrollViewFrame.midY)
      )
      if scrollView.contentSize != contentSize {
        scrollView.contentSize = contentSize
      }

      var scrollBounds = CGRect(origin: scrollView.bounds.origin, size: scrollViewFrame.size)
      let shouldFocus = explicitFocus ?? (scrollView.bounds.size != scrollBounds.size)
      if shouldFocus, selectedItemFrame != .zero {
        let lookahead: CGFloat = 100.0
        if scrollBounds.maxX - lookahead < selectedItemFrame.maxX {
          scrollBounds.origin.x = selectedItemFrame.maxX - scrollBounds.width + lookahead
        }
        if scrollBounds.minX > selectedItemFrame.minX - lookahead {
          scrollBounds.origin.x = selectedItemFrame.minX - lookahead
        }
        scrollBounds.origin.x = min(
          max(0.0, contentSize.width - scrollBounds.width),
          max(0.0, scrollBounds.origin.x)
        )
      }
      transition.setBounds(view: scrollView, bounds: scrollBounds)

      transition.setFrame(
        view: contentClipView,
        frame: CGRect(
          x: 3.0,
          y: component.verticalInset,
          width: size.width - 6.0,
          height: contentHeight
        )
      )
      contentClipView.layer.cornerRadius = 0
      selectionView.layer.cornerRadius = contentHeight * 0.5
      ignoreScrolling = false

      updateScrolling(transition: transition)
    }

    private func updateScrolling(transition: ComponentTransition) {
      guard let layoutData else { return }

      let contentSize = CGSize(
        width: layoutData.size.width - 6.0,
        height: layoutData.size.height - (component?.verticalInset ?? 3.0) * 2.0
      )
      let selectedItemFrame = layoutData.selectedItemFrame
      selectionView.isHidden = selectedItemFrame == .zero
      transition.setFrame(
        view: selectionView,
        frame: CGRect(
          x: selectedItemFrame.minX - scrollView.contentOffset.x,
          y: 0.0,
          width: selectedItemFrame.width,
          height: contentSize.height
        )
      )
      transition.setFrame(
        view: selectedScrollView,
        frame: CGRect(
          x: -selectedItemFrame.minX,
          y: 0.0,
          width: scrollView.contentSize.width,
          height: contentSize.height
        )
      )
    }

    private func normalizedTransition(_ transition: ComponentTransition) -> ComponentTransition {
      UIAccessibility.isReduceMotionEnabled ? .immediate : transition
    }
  }
}

@MainActor
private final class HorizontalTabItemView: UIView, UIContextMenuInteractionDelegate {
  private static let sideInset: CGFloat = 16.0
  private static let badgeSpacing: CGFloat = 5.0
  private static let titleFont = UIFont.systemFont(ofSize: 15.0, weight: .medium)
  private static let badgeFont = UIFont.systemFont(ofSize: 12.0, weight: .medium)

  private let contentView = UIView()
  private let titleLabel = UILabel()
  private let badgeView = UIView()
  private let badgeLabel = UILabel()
  private let deleteButton = UIButton(type: .custom)
  private var customView: UIView?
  private var customContentId: AnyHashable?
  private var tab: HorizontalTabsComponent.Tab?

  override init(frame: CGRect) {
    super.init(frame: frame)

    titleLabel.font = Self.titleFont
    titleLabel.adjustsFontForContentSizeCategory = false
    titleLabel.isAccessibilityElement = false

    badgeLabel.font = Self.badgeFont
    badgeLabel.textAlignment = .center
    badgeLabel.isAccessibilityElement = false
    badgeView.isAccessibilityElement = false
    badgeView.addSubview(badgeLabel)

    deleteButton.setImage(Self.makeDeleteImage(), for: .normal)
    deleteButton.addTarget(self, action: #selector(deletePressed), for: .touchUpInside)
    deleteButton.accessibilityLabel = "删除标签页"

    addSubview(contentView)
    contentView.addSubview(titleLabel)
    contentView.addSubview(badgeView)
    addSubview(deleteButton)
    addInteraction(UIContextMenuInteraction(delegate: self))
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func update(
    tab: HorizontalTabsComponent.Tab,
    theme: HorizontalTabsComponent.Theme,
    isSelected: Bool,
    isAccessibilitySelected: Bool,
    isEditing: Bool,
    availableSize: CGSize,
    transition: ComponentTransition
  ) -> CGSize {
    self.tab = tab
    titleLabel.textColor = isSelected ? theme.selectedTextColor : theme.unselectedTextColor
    badgeLabel.textColor =
      isSelected ? theme.selectedBadgeForegroundColor : theme.unselectedBadgeForegroundColor
    deleteButton.tintColor = isSelected ? theme.selectedTextColor : theme.unselectedTextColor

    var size = CGSize(width: Self.sideInset, height: availableSize.height)
    let contentSize: CGSize

    switch tab.content {
    case .title(let title):
      titleLabel.isHidden = false
      titleLabel.text = title.text
      if let customView {
        self.customView = nil
        customContentId = nil
        customView.removeFromSuperview()
      }
      contentSize = titleLabel.sizeThatFits(CGSize(width: 300.0, height: 100.0))

    case .custom(let customContent):
      titleLabel.isHidden = true
      let customView: UIView
      if let current = self.customView, customContentId == customContent.id {
        customView = current
      } else {
        self.customView?.removeFromSuperview()
        customView = customContent.makeView()
        self.customView = customView
        customContentId = customContent.id
        contentView.addSubview(customView)
      }
      contentSize = customContent.updateView(
        customView,
        isSelected,
        CGSize(width: 300.0, height: 100.0)
      )
    }
    size.width += ceil(contentSize.width)

    let showsBadge = tab.badge != nil && tab.deleteAction == nil
    badgeView.isHidden = !showsBadge
    if let badge = tab.badge, showsBadge {
      badgeLabel.text = badge.title
      badgeView.backgroundColor =
        isSelected ? theme.selectedBadgeBackgroundColor : theme.unselectedBadgeBackgroundColor
      size.width += Self.badgeSpacing
      let badgeTextSize = badgeLabel.sizeThatFits(CGSize(width: 100.0, height: 100.0))
      let badgeSize = CGSize(
        width: ceil(badgeTextSize.width) + 10.0, height: ceil(badgeTextSize.height) + 3.0)
      badgeView.layer.cornerRadius = badgeSize.height * 0.5
      transition.setFrame(
        view: badgeView,
        frame: CGRect(
          x: size.width,
          y: floor((size.height - badgeSize.height) * 0.5),
          width: badgeSize.width,
          height: badgeSize.height
        )
      )
      badgeLabel.frame = badgeView.bounds
      size.width += badgeSize.width - 2.0
    }

    let showsDelete = tab.deleteAction != nil
    deleteButton.isHidden = !showsDelete
    if showsDelete, let image = deleteButton.image(for: .normal) {
      let buttonFrame = CGRect(
        x: size.width + 2.0,
        y: 0.0,
        width: image.size.width + 12.0,
        height: size.height
      )
      transition.setFrame(view: deleteButton, frame: buttonFrame)
      size.width += buttonFrame.width - 3.0
    }
    size.width += Self.sideInset

    let mainContentFrame = CGRect(
      x: Self.sideInset,
      y: floor((size.height - contentSize.height) * 0.5),
      width: contentSize.width,
      height: contentSize.height
    )
    if titleLabel.isHidden {
      if let customView {
        transition.setFrame(view: customView, frame: mainContentFrame)
      }
    } else {
      transition.setFrame(view: titleLabel, frame: mainContentFrame)
    }
    transition.setFrame(view: contentView, frame: CGRect(origin: .zero, size: size))

    isAccessibilityElement = true
    accessibilityLabel = tab.accessibilityLabel ?? defaultAccessibilityLabel(for: tab)
    accessibilityIdentifier = tab.accessibilityIdentifier
    accessibilityValue = isAccessibilitySelected ? "已选择" : nil
    accessibilityTraits = isAccessibilitySelected ? [.button, .selected] : [.button]

    updateIsShaking(isEditing && tab.isEditable)
    return size
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configurationForMenuAtLocation location: CGPoint
  ) -> UIContextMenuConfiguration? {
    tab?.contextAction?(self)
  }

  @objc private func deletePressed() {
    tab?.deleteAction?()
  }

  private func defaultAccessibilityLabel(for tab: HorizontalTabsComponent.Tab) -> String? {
    guard case .title(let title) = tab.content else { return nil }
    if let badge = tab.badge {
      return "\(title.text)，\(badge.title)"
    }
    return title.text
  }

  private func updateIsShaking(_ isShaking: Bool) {
    if isShaking {
      guard layer.animation(forKey: "shaking_position") == nil else { return }

      let position = CAKeyframeAnimation(keyPath: "position")
      position.duration = 0.4
      position.values = [
        NSValue(cgPoint: CGPoint(x: -1.0, y: -1.0)),
        NSValue(cgPoint: .zero),
        NSValue(cgPoint: CGPoint(x: -1.0, y: 0.0)),
        NSValue(cgPoint: CGPoint(x: 0.0, y: -1.0)),
        NSValue(cgPoint: CGPoint(x: -1.0, y: -1.0)),
      ]
      position.calculationMode = .linear
      position.isRemovedOnCompletion = false
      position.repeatCount = .greatestFiniteMagnitude
      position.beginTime = CFTimeInterval(Float.random(in: 0.0...0.25))
      position.isAdditive = true

      let transform = CAKeyframeAnimation(keyPath: "transform")
      transform.duration = 0.3
      transform.valueFunction = CAValueFunction(name: .rotateZ)
      transform.values = [-CGFloat.pi / 90.0, CGFloat.pi / 90.0, -CGFloat.pi / 90.0]
      transform.calculationMode = .linear
      transform.isRemovedOnCompletion = false
      transform.repeatCount = .greatestFiniteMagnitude
      transform.beginTime = CFTimeInterval(Float.random(in: 0.0...0.25))
      transform.isAdditive = true

      layer.add(position, forKey: "shaking_position")
      layer.add(transform, forKey: "shaking_rotation")
    } else if layer.animation(forKey: "shaking_position") != nil {
      layer.removeAnimation(forKey: "shaking_position")
      layer.removeAnimation(forKey: "shaking_rotation")
    }
  }

  private static func makeDeleteImage() -> UIImage? {
    let size = CGSize(width: 12.0, height: 12.0)
    return generateImage(size) { size, context in
      context.clear(CGRect(origin: .zero, size: size))
      context.setStrokeColor(UIColor.white.cgColor)
      context.setLineWidth(1.33)
      context.setLineCap(.round)
      context.move(to: CGPoint(x: 1.0, y: 1.0))
      context.addLine(to: CGPoint(x: size.width - 1.0, y: size.height - 1.0))
      context.strokePath()
      context.move(to: CGPoint(x: size.width - 1.0, y: 1.0))
      context.addLine(to: CGPoint(x: 1.0, y: size.height - 1.0))
      context.strokePath()
    }?.withRenderingMode(.alwaysTemplate)
  }
}
