# 发现 Tab

状态：已确认 · 更新：2026-08-22 · 任务：IOS-D03、IOS-A01、IOS-D07、IOS-E04、IOS-E16

返回 [设计总览](../2026-08-17-ios-app-design.md)。

## 页面职责

发现负责浏览或检索内容、检查详情，并将内容导入当前服务器或交给 Helper 订阅。它不是媒体库，也不复制桌面端双栏预览器。

共享范围仅包括导航壳层、Provider 状态、错误状态和导入入口；Mikan 与 M-Team 保持不同正文布局。

## 页面地图

```text
发现根页面
├── Mikan
│   ├── 当季海报墙 / 番组搜索结果
│   ├── 番组详情
│   └── 我的订阅
└── M-Team
    ├── 搜索与结果列表
    └── Torrent 详情

详情 → 单项导入 Sheet
番组详情 → 批量导入或订阅配置 Sheet
```

## 共享根页面提案

- Large Title：`发现`。
- Large Subtitle：当前 Provider；存在多个可用 Provider 时作为 Menu，只有一个时为静态文本。
- Provider 只在根页面切换；详情页面不显示切换器。
- 右上角按 Provider 能力显示次级入口，例如 Mikan 的“我的订阅”及数量 Badge。
- 搜索使用顶部原生 Search，不增加第四个 Search Tab，也不与底部传输 Accessory 竞争空间。
- 切换 Provider 时保留各自的搜索、筛选和滚动位置，但回到对应根页面。
- 未配置的 Provider 不进入切换菜单；无可用 Provider 时显示前往设置的空状态。

不在根页面常驻当前服务器或 Helper Chip。导入与订阅发生时再明确目标和可用性，避免导航区同时出现 Provider、服务器、Helper 和搜索四种上下文。

## Mikan 根页面提案

空查询显示选定季度的海报墙，非空查询显示全站番组搜索结果；两者使用同一根页面。

- 年份和季度合并为一个紧凑 Menu，例如 `2026 · 夏`。
- 海报墙按星期分节，iPhone 使用两列自适应 Grid。
- 海报是主要视觉锚点，不增加外层卡片背景。
- 海报下只显示两行标题和一行必要元数据。
- 仅显示有产品意义的覆盖标记，例如已订阅或今日更新；不堆叠标签。
- “我的订阅”是 Toolbar 入口，不与当季形成 Segment Tab。
- 点击海报 Push 番组详情；从详情返回时恢复海报墙或搜索结果位置。

## Mikan 番组详情提案

1. 封面、标题、季度、放送信息和外部 Bangumi 链接。
2. 字幕组 Menu；不使用容纳不下的横向 Chip 集合。
3. 订阅或编辑目标、导入该组已出。
4. 当前字幕组的 Episode List。
5. Episode 行显示标题、大小、发布时间和 Helper/qBittorrent 状态。

单集导入进入与任务 Tab 相同的 Add Torrent Sheet。批量导入和订阅通过 Helper；Helper 不可用时保留页面内容，只禁用相关动作并提供前往设置的说明。

## 我的订阅：追番主页提案

2026-08-22 由 IOS-D07 确认升级。页面从订阅管理列表升级为追番主页；定位仍是 Mikan Toolbar 入口，不新增一级结构。

### 页面骨架

- Push 自发现根页面；Large Title「我的订阅」；导航右侧不加编辑按钮，管理动作维持 Swipe 与 Context Menu。
- 副标题行：`N 部订阅 · K 部有新集`，由 Helper 快照与本地 lastSeen 基线计算；无新集时只显示订阅数。
- 周条：左端固定「全部」chip，随后周一至周日（含日期）；默认选中「全部」。圆点标记该日有新集；新集判定使用本地 lastSeen 基线，仅用于展示，不是真相源。

### 全部态与单日态

- 「全部」态按节分组：今天 → 明天 → 本周其余按天（自今天起环绕排序）→ 未定档沉底；行副标题附带星期。
- 单日态仅显示该日订阅；无订阅的日期显示空态文案；未定档不出现在单日态。
- 行解剖两态一致：封面 40×54、标题、字幕组与已收 N 集（等宽数字）、状态 chip。
- chip 仅三种语义：有新集（强调色）、同步中（灰）、失败·重试（红）；失败优先于有新集，全部完成时不显示 chip。
- 点击 Push 同一个番组详情，并恢复对应字幕组。
- Swipe 或 Context Menu 提供编辑目标、重试失败剧集和取消订阅。
- 取消订阅必须说明是否保留已添加的 Torrent 与文件。

### 数据与降级

- 数据源不变：Helper `GET /subscriptions` 聚合副本，iOS 不新增真相源。
- 放送星期与封面来自海报墙和搜索结果的解析缓存（按 bangumiId 归档）；缺失时归入未定档，不为它新增网络请求。
- lastSeen 基线记录每订阅的已收剧集数，离开页面时推进；缺失基线视为已读，不产生批量新集标记。
- Helper 不可达时保留最后快照并显示时间戳横幅；周条与浏览仍可用，导入类动作禁用。
- 周条只显示本周，随真实日期滚动。
- 非目标：精确时刻倒计时、月历网格、本地「在追」追踪域、顶部编辑按钮。

## M-Team 根页面提案

M-Team 不存在自然的海报墙首页，因此根页面以搜索为主：

- 空查询显示简洁搜索提示；不伪造推荐内容。
- 搜索由用户提交，不在每次输入时请求 Tracker。
- `类型`、`优惠`、`分类` 收入 Filter Menu 或独立 Filter Sheet，不复制桌面端横向表单。
- 搜索结果使用信息密集的原生 List。
- 行显示标题、分类、大小、发布时间、做种/下载人数和优惠状态。
- 默认点击 Push Torrent 详情；多选通过系统编辑模式进入。
- 分页使用列表末尾的“加载更多”，不在手机底部放上一页/下一页工具条。

## M-Team Torrent 详情提案

详情按阅读顺序组织：标题与关键指标、简介、截图、文件列表、外部链接。导入是唯一突出动作，最终 Sheet 明确目标服务器、保存路径、分类和标签。

桌面端的侧边 Preview Panel 不进入 iOS；详情始终使用导航 Push。

## 状态与边界

| 状态            | 行为                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| 无 Provider     | 显示配置入口                                                              |
| Provider 未就绪 | 保留页面壳层，解释缺失配置                                                |
| 浏览或搜索失败  | 保留最后一次成功内容并提供内联重试                                        |
| 无活动服务器    | 保留页面壳层和已有内容；导入、订阅不可用；是否允许重新浏览由 IOS-A01 决定 |
| Helper 不可达   | 单集直连导入仍可用；订阅和批量导入不可用                                  |
| 切换 Provider   | 返回对应根页面并恢复该 Provider 状态                                      |

## 当前问题：iOS 内容服务契约

调研结论：截至 2026-08-17，未发现 Mikan 官方公开的 JSON、OpenAPI 或 SDK。官方可确认的结构化入口只有 RSS；站内 `/Home/...` 异步请求仍返回 HTML 片段，不构成稳定 API 契约。

| 能力         | 官方入口                             | 可替代现有解析 |
| ------------ | ------------------------------------ | -------------- |
| 当季海报墙   | 服务端 HTML                          | 否             |
| 番组搜索     | `/Home/Search` HTML                  | 否             |
| 番组详情     | `/Home/Bangumi/{id}` HTML            | 否             |
| Torrent 搜索 | `/RSS/Search?searchstr=...`          | 部分           |
| 番组更新流   | `/RSS/Bangumi?...`、`/RSS/MyBangumi` | 部分           |

RSS 可用于 Episode、Torrent 链接和订阅更新，但不提供海报墙、番组实体搜索、完整详情或字幕组目录。因此实现前必须选择：

| 方案                      | 影响                                 |
| ------------------------- | ------------------------------------ |
| App 内置 JavaScriptCore   | 复用 TypeScript 逻辑，需要稳定桥接层 |
| Helper 提供标准化内容 API | 解析集中，但浏览依赖 Helper          |
| Swift 独立实现解析        | 可直接浏览，但产生重复且脆弱的解析器 |
| 独立内容服务              | 跨平台一致，但增加部署与维护成本     |

### JavaScriptCore 方案

现有生产解析器只依赖 ECMAScript 字符串、正则与集合，不依赖 DOM、Cheerio 或 Node.js。最小运行验证已证明海报墙解析可直接执行；详情解析当前只缺少 JavaScriptCore 不提供的 `URL` Web API。

```text
URLSession → HTML / XML → App 内置 MikanParser.js → JSContext → JSON → Swift Codable
```

- TypeScript 预编译为 IIFE，并作为只读资源随 App 发布；不下载或执行远程代码。
- 网络、Cookie、重试和 URL 归一化由 Swift 负责；JavaScript 只执行纯解析。
- 单个 Actor 或串行执行器持有 `JSVirtualMachine` 与 `JSContext`，解析不占用主线程。
- 桌面端测试夹具同时验证 TypeScript 源码和最终 JavaScriptCore Bundle。
- Helper 继续承担持续订阅和批量导入；浏览不再依赖 Helper 在线。

采用 App 内置 JavaScriptCore。无服务器或 Helper 不可达时仍可浏览 Mikan，只禁用导入与订阅动作。

## 实现状态

- `URLSession` 已接入季度 wall、即时搜索和番组详情 HTML。
- Bundle 内 JavaScriptCore 解析器负责 wall/search/detail；Swift 负责 URL、网络和模型解码。
- 番组详情使用 UIKit 导航 Push；单集直连导入已接入，Helper 批量导入与订阅留到后续批次。

### IOS-E16 M-Team Discover

- M-Team 与 Mikan 共用 Discover 导航壳层，但分别保留查询、筛选和结果状态；M-Team 仅在用户显式提交时发起搜索。
- 搜索接入 M-Team `/torrent/search`，Filter Sheet 承载模式、优惠和分类，结果列表支持继续加载。
- Torrent 详情通过 UIKit 导航 Push 展示指标、简介、截图、文件、媒体信息和外部链接。
- 折扣使用无图标的小型 Badge，附着在 Torrent 标题尾部；不在指标下方占用独立上下文行。
- 导入前调用 `/torrent/genDlToken` 生成临时链接，再进入既有 Add Torrent Sheet；目标服务器仍由用户确认，不自动提交下载。
- API Key 只存入 Keychain；UserDefaults 仅保存启用状态、Base URL、模式和分页大小，诊断信息不暴露凭据。
- Simulator Demo Repository 仅验证原生交互和渲染，不代表真实 M-Team 账号或 Tracker 网络已通过验收；请求契约由 URLProtocol 行为测试覆盖。

### IOS-E18 M-Team 多选与批量导入

- M-Team 结果页使用系统编辑模式；进入多选后隐藏根 Tab Bar，并由 UIKit Toolbar 显示选择数量和批量导入动作。
- 批量确认页统一选择目标服务器、保存路径、分类、标签和上下行限速；临时下载链接只在最终确认后逐项生成。
- 每项独立记录成功或失败；失败重试只处理未成功项目，不重复生成或提交已成功资源。
- Demo Repository 验证原生多选、确认和反馈；行为测试验证确认边界与部分失败重试语义。

### IOS-E06 单集导入

- Episode 行提供直连导入动作，并以该条目的 Torrent URL 预填共享 Add Torrent Sheet。
- Sheet 必须再次显示目标服务器；无服务器时禁用导入，但浏览和详情保持可用。
- 单集导入不经过 Helper；批量导入与持续订阅仍由后续 Helper 批次负责。
- Helper 批次的多客户端所有权约束见 [Helper 集成边界](helper-integration.md)。

### IOS-E23 追番主页

- 周条左端「全部」chip 默认选中；全部态按自今天起环绕的星期分节，未定档沉底，行副标题附带星期。
- 单日态仅显示该日订阅，空日显示「这一天没有放送更新。」；行副标题省略星期。
- 放送星期与封面来自海报墙和搜索解析结果按 bangumiId 归档的目录缓存，UserDefaults 持久化，不新增网络请求。
- lastSeen 基线记录每订阅已收剧集数，离开页面时推进；新集判定只驱动「有新集」chip 与周条圆点，不是真相源。
- Helper 不可达时按服务器显示本地快照时间戳横幅，浏览保持可用。
- 行为测试覆盖星期环绕排序、chip 优先级、基线推进、跨服务器剧集去重、目录合并与持久化重载。

## 已确认结论

1. 根页面使用 `发现` Title + Provider Subtitle/Menu。
2. 搜索位于顶部；Mikan 即时搜索，M-Team 提交搜索。
3. Mikan 使用季度海报墙；订阅作为 Toolbar 入口。
4. M-Team 使用列表、Filter Sheet 和 Push 详情。
5. Helper 状态按动作出现，不常驻根页面。
6. 我的订阅升级为追番主页：周条加「全部」驻留，全部态按天分组、未定档沉底，单日态聚焦当天。

无服务器时仍可请求新内容；服务器和 Helper 只影响导入、批量操作与订阅。
