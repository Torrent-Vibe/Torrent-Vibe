## 本轮说明

Demo 任务由 12 条扩充至 20 条，涵盖下载、做种、完成、暂停、排队与错误状态。分页容器显式向 UIKit 注册当前 List 的垂直 `UIScrollView`，使系统 `.onScrollDown` 最小化行为能够穿过 SwiftUI 与 `UIPageViewController` 的嵌套层级。

`UITabAccessory` 的 regular 外层宽度由 UIKit 决定；进入 inline 环境后，证据显示其自动收缩为内容宽度附近的紧凑胶囊，并与当前 Tab 图标同排。

发布前门禁：当前完整 iOS 工作树构建成功；148 项单元测试通过；2 项附件状态 UI 测试及 1 项 20 条任务全选 UI 测试通过；`swift-format lint --strict` 与 `git diff --check` 通过。

限制：验证设备为 iPhone 17 Pro iOS 26.5 Simulator，不用于证明物理设备性能或触觉体验。
