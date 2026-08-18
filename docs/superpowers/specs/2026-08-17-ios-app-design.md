# Torrent Vibe iOS 设计总览

2026-08-17 · 状态：推进中

本文档只维护总体决策、任务状态和执行记录。具体设计按章节拆分；章节在开始讨论时创建，不提前写入大段占位内容。

## 文档规则

- 每轮讨论对应一个可追踪任务。
- 状态仅使用：`未开始`、`讨论中`、`已确认`、`实现中`、`有问题`、`已完成`。
- 设计达成一致后标记为 `已确认`；代码与验证完成后才标记为 `已完成`。
- 总览只记录结论和链接，细节进入对应章节。
- 新结论必须同步更新任务状态和执行记录。

## 已确认的全局决策

| 决策         | 结论                                                        |
| ------------ | ----------------------------------------------------------- |
| 最低系统版本 | iOS 26.0                                                    |
| 设计语言     | iOS 26 HIG；系统组件优先；Liquid Glass 只用于导航与控制层   |
| 一级导航     | 三个底部 Tab：任务、发现、设置                              |
| 服务器位置   | 归入设置；任务与发现保留当前服务器上下文入口                |
| 架构所有权   | UIKit 管理生命周期、Tab、导航栈和呈现；SwiftUI 作为叶子内容 |
| 导航状态     | 三个 Tab 各自持有独立导航栈并保留状态                       |

详细约束见 [全局基础](ios-app/foundation.md)。

## 任务看板

| ID         | 任务                                | 状态   | 章节或产物                              | 下一步                |
| ---------- | ----------------------------------- | ------ | --------------------------------------- | --------------------- |
| IOS-D01    | 全局产品、架构与 iOS 26 视觉基础    | 已确认 | [全局基础](ios-app/foundation.md)       | 实现前复核            |
| IOS-D02    | 任务 Tab 页面布局与功能承载         | 已确认 | [任务 Tab](ios-app/tasks-tab.md)        | 后续进入实现拆解      |
| IOS-D03    | 发现 Tab 页面布局与功能承载         | 已确认 | [发现 Tab](ios-app/discover-tab.md)     | 后续进入实现拆解      |
| IOS-D04    | 设置 Tab 页面布局与功能承载         | 已确认 | [设置 Tab](ios-app/settings-tab.md)     | 后续进入实现拆解      |
| IOS-D06    | iOS 内容密度与语义间距规范          | 已确认 | [全局基础](ios-app/foundation.md)       | 已由 IOS-E16 修正落地 |
| IOS-R01    | 调研 Mikan 官方开放 API             | 已完成 | [发现 Tab](ios-app/discover-tab.md)     | 结论并入 IOS-A01      |
| IOS-R02    | 验证 Mikan 解析器的 JSC 兼容性      | 已完成 | [发现 Tab](ios-app/discover-tab.md)     | 结论并入 IOS-A01      |
| IOS-A01    | iOS Discover 内容服务契约           | 已确认 | [发现 Tab](ios-app/discover-tab.md)     | 实现由 IOS-E03 承接   |
| IOS-E01    | 将工程最低目标从 iOS 18 改为 iOS 26 | 已完成 | `apps/ios/project.yml`                  | —                     |
| IOS-E02    | 按最终信息架构调整三个根 Tab        | 已完成 | `apps/ios/Sources/App`                  | —                     |
| IOS-E03    | 构建 Mikan JavaScriptCore 运行时    | 已完成 | `packages/mikan`、`apps/ios`            | —                     |
| IOS-E04    | 接入 Mikan 原生网络内容服务         | 已完成 | [发现 Tab](ios-app/discover-tab.md)     | —                     |
| IOS-E05    | 接入真实 qBittorrent 任务服务       | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E06    | 共享 Add Torrent Sheet 与单集导入   | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-R03    | 核对 Helper 多客户端契约            | 已完成 | [Helper](ios-app/helper-integration.md) | 结论并入 IOS-D05      |
| IOS-D05    | Helper 配对与订阅所有权             | 已确认 | [Helper](ios-app/helper-integration.md) | 已由 HELPER-E01 承接  |
| HELPER-E01 | Helper 多客户端协议升级             | 已完成 | [Helper](ios-app/helper-integration.md) | —                     |
| IOS-E07    | Helper 配对与只读状态               | 已完成 | [Helper](ios-app/helper-integration.md) | —                     |
| IOS-E08    | 批量导入与持续订阅                  | 已完成 | [Helper](ios-app/helper-integration.md) | —                     |
| IOS-E09    | 订阅目标编辑与详情回跳              | 已完成 | [Helper](ios-app/helper-integration.md) | —                     |
| IOS-E10    | 任务筛选、基础详情与暂停/继续       | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E11    | 服务器管理与 iPhone 内测交付        | 已完成 | `apps/ios`、TestFlight                  | —                     |
| IOS-E12    | 文件导入、安全删除与批量管理        | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E13    | 任务文件、Tracker 与 Peer 检查器    | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E14    | 顺序下载与首尾分片优先控制          | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E15    | 系统 Share Extension 导入闭环       | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E16    | M-Team 搜索、详情与导入闭环         | 已完成 | [发现 Tab](ios-app/discover-tab.md)     | —                     |
| IOS-E17    | 内容来源连接测试与显式保存边界      | 已完成 | [设置 Tab](ios-app/settings-tab.md)     | —                     |
| IOS-E18    | M-Team 多选与批量导入               | 已完成 | [发现 Tab](ios-app/discover-tab.md)     | —                     |
| IOS-E19    | 后台任务状态与下载完成通知          | 已完成 | [设置 Tab](ios-app/settings-tab.md)     | —                     |
| IOS-E20    | App Intents 与系统快捷指令          | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |
| IOS-E21    | 实时活动与灵动岛                    | 已完成 | [任务 Tab](ios-app/tasks-tab.md)        | —                     |

## 当前焦点

`IOS-E21` 已完成。下一实施任务待讨论确认。

## 执行记录

| 日期       | 执行                        | 结果                                                   | 状态变化                           |
| ---------- | --------------------------- | ------------------------------------------------------ | ---------------------------------- |
| 2026-08-17 | 建立原生 UIKit iOS 基础架构 | App 壳层、四个临时功能边界和演示数据已存在             | 基础架构已完成                     |
| 2026-08-17 | 确认最终一级导航和视觉方向  | 三个 Tab、iOS 26、原生系统设计语言敲定                 | IOS-D01 → 已确认                   |
| 2026-08-17 | 讨论任务 Tab                | 根页面、状态 accessory、搜索、筛选、详情和添加流程敲定 | IOS-D02 → 已确认                   |
| 2026-08-17 | 重构设计文档                | 长文拆分为短总览与按需章节                             | 文档结构已完成                     |
| 2026-08-17 | 开始讨论发现 Tab            | 建立共享壳层和 Provider 专属正文提案                   | IOS-D03 → 讨论中                   |
| 2026-08-17 | 调研 Mikan 官方开放 API     | 未发现公开 JSON API；官方 RSS 只能覆盖 Torrent Feed    | IOS-R01 → 已完成                   |
| 2026-08-17 | 验证 JavaScriptCore 可行性  | 海报墙解析通过；详情仅受缺失 `URL` Web API 阻塞        | IOS-R02 → 已完成                   |
| 2026-08-17 | 确认 Discover 内容服务契约  | App 内置 JSC 解析；浏览与 Helper 解耦                  | IOS-A01 → 已确认                   |
| 2026-08-17 | 开始讨论设置 Tab            | 建立根页面和连接配置层级提案                           | IOS-D04 → 讨论中                   |
| 2026-08-18 | 确认设置 Tab                | 根页面、服务器、Helper、Provider 和诊断层级敲定        | IOS-D04 → 已确认                   |
| 2026-08-18 | 开始首个 iOS 实现批次       | iOS 26、三个根 Tab 与 JSC 运行时同步推进               | E01–E03 → 实现中                   |
| 2026-08-18 | 完成首个 iOS 实现批次       | iOS 26 构建、三 Tab 交互和 Bundle 内 JSC 解析均已验证  | E01–E03 → 已完成                   |
| 2026-08-18 | 接入 Mikan 实时内容         | wall、即时搜索与原生 Push 详情通过 URLSession + JSC    | IOS-E04 → 已完成                   |
| 2026-08-18 | 接入真实下载器              | Keychain 登录、任务与传输速率刷新、重启恢复均已验证    | IOS-E05 → 已完成                   |
| 2026-08-18 | 开始单集导入闭环            | 确认共享 Sheet、显式目标服务器和直连 qBittorrent 边界  | IOS-E06 → 实现中                   |
| 2026-08-18 | 完成单集导入闭环            | Tasks 与 Mikan 单集共用 Sheet；提交、刷新和反馈已验证  | IOS-E06 → 已完成                   |
| 2026-08-18 | 核对 Helper iOS 接入边界    | 发现共享 Token、全量覆盖与跨客户端解绑冲突             | IOS-R03 → 已完成；IOS-D05 → 讨论中 |
| 2026-08-18 | 确认 Helper 多客户端模型    | 独立客户端 Token、Helper 真相源、revision 与独立解绑   | IOS-D05 → 已确认                   |
| 2026-08-18 | 开始 Helper v2 协议升级     | Go Helper、桌面兼容层与迁移测试进入实现                | HELPER-E01 → 实现中                |
| 2026-08-18 | 完成 Helper v2 协议升级     | 独立凭据、自解绑、revision 冲突和旧 Token 迁移已验证   | HELPER-E01 → 已完成                |
| 2026-08-18 | 完成 iOS Helper 配对与状态  | Bonjour、手动端点、Keychain、重启恢复和自解绑已验证    | IOS-E07 → 已完成                   |
| 2026-08-18 | 开始订阅与批量导入闭环      | Helper 真相源、revision 合并、状态与重试进入实现       | IOS-E08 → 实现中                   |
| 2026-08-18 | 完成订阅与批量导入闭环      | 多目标订阅、409 合并、backfill、状态和重试已验证       | IOS-E08 → 已完成                   |
| 2026-08-18 | 开始订阅管理导航闭环        | 多 Helper 聚合、目标编辑与详情回跳进入实现             | IOS-E09 → 实现中                   |
| 2026-08-18 | 完成订阅管理导航闭环        | 单行聚合、目标编辑与带字幕组回跳均已验证               | IOS-E09 → 已完成                   |
| 2026-08-18 | 开始任务管理纵向闭环        | 状态筛选、基础详情与暂停/继续进入实现                  | IOS-E10 → 实现中                   |
| 2026-08-18 | 完成任务管理纵向闭环        | 状态筛选、原生详情、暂停与继续均已验证                 | IOS-E10 → 已完成                   |
| 2026-08-18 | 收口服务器与内测交付        | 服务器增删改、连接验证、App 图标与 TestFlight 均已验收 | IOS-E11 → 已完成                   |
| 2026-08-18 | 完成任务管理第二阶段        | 文件导入、安全删除、管理选项与批量工具栏均已验证       | IOS-E12 → 已完成                   |
| 2026-08-18 | 完成任务内容检查器          | 文件、Tracker 与 Peer 按需加载子页面均已验证           | IOS-E13 → 已完成                   |
| 2026-08-18 | 完成任务下载策略控制        | 顺序下载与首尾分片优先状态、切换和重新进入均已验证     | IOS-E14 → 已完成                   |
| 2026-08-18 | 完成系统分享导入闭环        | Magnet 与 Torrent 文件经 Share Extension 进入既有导入  | IOS-E15 → 已完成                   |
| 2026-08-18 | 完成 M-Team Discover 接入   | 提交搜索、筛选、Push 详情和共享导入流程均已验证        | IOS-E16 → 已完成                   |
| 2026-08-18 | 完成内容来源连接测试        | Mikan 可达性、M-Team 只读检索与显式保存边界均已验证    | IOS-E17 → 已完成                   |
| 2026-08-18 | 建立全局内容密度规范        | 语义间距、单一间距所有者与紧凑指标组件已落地           | IOS-D06 → 已确认                   |
| 2026-08-18 | 完成 M-Team 批量导入        | 系统多选、公共选项、逐项结果与失败重试均已验证         | IOS-E18 → 已完成                   |
| 2026-08-18 | 完成后台状态与本地通知      | 系统调度、完成状态基线、显式授权与立即检查均已验证     | IOS-E19 → 已完成                   |
| 2026-08-18 | 完成系统快捷指令            | 三个 App Intents、系统元数据与 Magnet 确认交接已验证   | IOS-E20 → 已完成                   |
| 2026-08-18 | 完成实时活动与灵动岛        | 单任务跟踪、锁屏卡片、灵动岛与完成收尾均已验证         | IOS-E21 → 已完成                   |
