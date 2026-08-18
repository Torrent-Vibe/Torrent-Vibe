# iOS App 全局基础

状态：已确认 · 更新：2026-08-18

返回 [设计总览](../2026-08-17-ios-app-design.md)。

## 产品定位

Torrent Vibe for iOS 是用于管理远程 qBittorrent、发现内容并向服务器投递任务的原生客户端。它不是桌面界面的缩小版本，也不是媒体库。

产品承担三项职责：

1. 监控和控制现有下载任务。
2. 发现或提交内容，并投递到指定服务器。
3. 管理服务器、凭据、Helper 和应用行为。

## 应用结构

```text
RootTabBarController
├── TasksNavigationController
│   ├── 任务根页面
│   ├── Torrent 详情
│   └── 添加 Torrent Sheet
├── DiscoverNavigationController
│   ├── 发现根页面
│   ├── 内容详情
│   └── 导入或订阅 Sheet
└── SettingsNavigationController
    ├── 设置根页面
    ├── 服务器
    ├── Helper
    └── 关于与诊断
```

- UIKit 管理应用生命周期、Tab、导航栈、工具栏和系统呈现。
- SwiftUI 仅作为 UIKit 页面内部的叶子内容。
- 三个 Tab 各自保持导航位置和页面状态。
- 层级详情使用 push；创建和集中配置使用 UIKit-owned sheet。
- Tab Bar 只用于一级导航，不承载添加、暂停或导入等动作。

## iOS 26 视觉约束

视觉原则：内容和状态保持主导，Liquid Glass 只形成悬浮的导航与控制层。

- 最低部署目标为 iOS 26.0，不设计 iOS 18–25 的视觉兼容方案。
- 使用系统 Tab Bar、Navigation Bar、Toolbar、Search、Menu、Alert 和 Sheet。
- 不在系统 Bar 后叠加自定义背景、模糊或深色遮罩。
- 不将 Liquid Glass 用作列表行、普通设置分组或装饰卡片背景。
- 内容层使用系统语义背景、分组列表和普通 material。
- 使用系统字体、Dynamic Type、SF Symbols 和语义颜色。
- 速度、大小、比例、进度和 ETA 使用等宽数字。
- 主强调色保持单一；状态色仅表达下载、做种、警告、错误和破坏性动作。
- 验证更大字体、增强对比度、降低透明度、减少动态效果和 VoiceOver。

## 内容密度与语义间距

页面间距必须表达内容关系，禁止为每个 `VStack`、`HStack` 或 `padding` 独立选择近似数值。App 使用以下全局语义层级：

| 层级     | 间距  | 用途                               |
| -------- | ----- | ---------------------------------- |
| 原子     | 4 pt  | 图标与数值、标题与直接说明         |
| 关联     | 8 pt  | 同一信息组内的相邻内容             |
| 分组     | 12 pt | 标题组、指标组、状态组等不同语义块 |
| 并列指标 | 16 pt | 横向独立指标单元之间               |
| 页面区段 | 20 pt | 仅用于自定义容器中的独立页面区段   |

实现遵循以下约束：

- 同一复合行内的垂直间距不得超过 12 pt；20 pt 不用于 `List` 或 `Form` 行内部。
- 系统容器负责外围间距。`List`、`Form` 行使用系统默认 inset，或由页面通过一次 `listRowInsets` 明确覆盖；行根容器不得再叠加垂直 `padding`。
- 三种以上语义内容不得放入单个扁平 `VStack`；先按语义嵌套为标题、指标、状态等组，再应用相应间距。
- 密集指标统一使用 `CompactMetric` 或 `CompactMetricStrip`：图标占 18 pt 对齐宽度，图标与数值间隔 4 pt，指标之间间隔 16 pt。
- 指标行不使用 `Spacer` 强制平均铺满；空间不足时由 `CompactMetricStrip` 换为两行，而不是扩大间距或压缩文字。
- 折扣、状态等短 Badge 使用 `caption2`，归入标题组并与标题保持关联；不得为一个短 Badge 在指标下方增加独立上下文行。
- 数值使用等宽数字；每个仅显示图标和数值的指标必须提供可访问名称。

新增或修改复合列表行时，至少在 402 pt 宽度、默认字号和一档辅助功能字号下检查：同组内容紧凑、跨组层级清晰、图标列对齐，并且不存在裁切、重叠或重复外围间距。

## 全局服务器上下文

- 设置负责服务器的添加、编辑、删除、凭据、诊断和 Helper 配对。
- 任务始终显示当前服务器及其连接状态。
- 发现默认向当前服务器导入，但最终动作必须再次明确目标服务器。
- 上下文服务器菜单只负责在已有服务器之间切换，不复制完整管理功能。
- 删除当前服务器时必须选择替代服务器，或回到无服务器状态。

## 状态与数据边界

- 不继续将所有业务状态加入单一 `AppModel`。
- 后续分别建立服务器会话、任务、发现和偏好状态域。
- 非敏感服务器元数据与 Keychain 凭据、会话信息分离存储。
- 每个功能先在确定性演示数据中覆盖加载、空、错误、缓存和正常状态，再接入真实服务。

## 实现前置项

1. 将 `apps/ios/project.yml` 的部署目标改为 iOS 26.0。
2. 重新生成并提交 Xcode 工程。
3. 将现有四个临时 Tab 调整为任务、发现、设置。
4. 保持 `AppDelegate → SceneDelegate → RootTabBarController → UINavigationController → UIKit feature controller → UIHostingController` 的所有权链。

## Apple 参考

- [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Build a UIKit app with the new design](https://developer.apple.com/videos/play/wwdc2025/284/)
