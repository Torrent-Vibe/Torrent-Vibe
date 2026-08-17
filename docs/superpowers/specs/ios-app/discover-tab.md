# 发现 Tab

状态：已确认 · 更新：2026-08-18 · 任务：IOS-D03、IOS-A01、IOS-E04

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

## 我的订阅提案

- 使用普通列表，不使用卡片堆叠。
- 行内容：封面、番组和字幕组、目标服务器、同步状态、最新 Episode。
- 点击 Push 同一个番组详情，并恢复对应字幕组。
- Swipe 或 Context Menu 提供编辑目标、重试和取消订阅。
- 取消订阅必须说明是否保留已添加的 Torrent 与文件。

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

### IOS-E06 单集导入

- Episode 行提供直连导入动作，并以该条目的 Torrent URL 预填共享 Add Torrent Sheet。
- Sheet 必须再次显示目标服务器；无服务器时禁用导入，但浏览和详情保持可用。
- 单集导入不经过 Helper；批量导入与持续订阅仍由后续 Helper 批次负责。
- Helper 批次的多客户端所有权约束见 [Helper 集成边界](helper-integration.md)。

## 已确认结论

1. 根页面使用 `发现` Title + Provider Subtitle/Menu。
2. 搜索位于顶部；Mikan 即时搜索，M-Team 提交搜索。
3. Mikan 使用季度海报墙；订阅作为 Toolbar 入口。
4. M-Team 使用列表、Filter Sheet 和 Push 详情。
5. Helper 状态按动作出现，不常驻根页面。

无服务器时仍可请求新内容；服务器和 Helper 只影响导入、批量操作与订阅。
