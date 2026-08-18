# Helper 集成边界

状态：已确认 · HELPER-E01 / IOS-E07–E09 / IOS-E22 已完成 · 更新：2026-08-19 · 任务：IOS-D05

返回 [设计总览](../2026-08-17-ios-app-design.md)。

## 升级前现状

- Helper 是每台下载主机的执行器；一个服务器配置最多关联一个 Helper。
- 桌面端在本地保存订阅真相，并以全量 `PUT /subscriptions` 覆盖 Helper 副本。
- Helper 只有一个共享 Token；`POST /unpair` 会轮换 Token，并清空全部副本与剧集状态。
- `/discover` 返回配对码，桌面端会自动提交；这不等同于用户持有主机控制权的证明。
- `/backfill` 是一次性导入已出剧集；持续订阅与其是两个独立动作。

## 当前问题

桌面端与 iOS 若都保存并推送自己的订阅集合，会形成最后写入者覆盖：任一端都可能删除另一端新建的订阅。共享 Token 还会使一端解绑后另一端立即失效。因此，现有契约只适用于单一控制端，不能直接承载完整 iOS 订阅管理。

## 推荐目标

| 主题       | 推荐结论                                                                |
| ---------- | ----------------------------------------------------------------------- |
| 订阅真相   | Helper 保存每台服务器的活动订阅；客户端只缓存展示数据                   |
| 并发写入   | 订阅集合增加 revision；写入携带预期 revision，冲突返回 `409` 后重新合并 |
| 客户端身份 | 每个客户端拥有独立 `clientId + token`，Token 存入 Keychain              |
| 解绑       | 只撤销当前客户端；清空 Helper 作为单独的破坏性“重置”动作                |
| 配对码     | Bonjour/`discover` 不返回配对码；用户输入 Helper 主机上显示的短码       |
| 一次性导入 | 继续使用 `/backfill`，不创建持续订阅                                    |

不建议继续沿用“桌面端为唯一真相、iOS 只读订阅”的长期方案；它会使 iOS 的 Discover 功能永久不完整。

## 多客户端边界

- 一台下载主机仍只部署一个 Helper，多台桌面端、iPhone 或 iPad 可以分别配对。
- 每次配对生成独立 `clientId + token`；Helper 只保存 Token Hash、客户端名称和必要审计时间。
- 首版所有已配对客户端权限相同，不增加管理员、只读等角色。
- 客户端使用普通 HTTP 请求与前台轮询，不引入 WebSocket、SSE 或常驻连接。
- 解绑只撤销当前客户端；撤销全部客户端与清空远端状态属于主机侧独立重置操作。

## v2 HTTP 契约

| 请求                 | 关键字段                                       | 结果                                         |
| -------------------- | ---------------------------------------------- | -------------------------------------------- |
| `GET /discover`      | 无配对码；`clientCount`、`requiresPairingCode` | 可达性与协议能力                             |
| `POST /pair`         | `code`、`clientId`、`clientName`               | 当前客户端的独立 Token                       |
| `POST /unpair`       | 当前 Bearer Token                              | 只撤销当前客户端                             |
| `GET /subscriptions` | —                                              | `{ revision, replicas }`                     |
| `PUT /subscriptions` | `revision`、完整 `replicas`                    | 成功递增 revision；过期返回 `409` 与当前快照 |
| `GET /profile`       | 当前 Bearer Token                              | `{ revision, records }`                      |
| `PATCH /profile`     | `revision`、显式 `set/delete` mutations        | 只修改列出的配置；过期返回 `409` 与当前快照  |

旧版 `bound: true + token` 在首次启动时迁移为 `legacy-desktop` 客户端；旧 Token 继续有效，磁盘只保留 Token Hash。旧版未绑定 Token 不获得客户端权限。

## 实现拆分

1. `HELPER-E01`（已完成）：多客户端 Token、revision 与兼容迁移。
2. `IOS-E07`（已完成）：Helper 发现、手动 URL、用户输入配对码、独立凭据、只读状态。
3. `IOS-E08`（已完成）：订阅、目标服务器、一次性批量导入、状态与重试。
4. `IOS-E09`（已完成）：聚合同一订阅的多 Helper 副本，编辑目标并回到 Mikan 详情。
5. `IOS-E22`（已完成）：Helper 保存通用凭证 Profile；桌面端与 iOS 选择分组后显式上传或拉取。
6. Helper 危险重置操作后置，不与配对或凭证同步同时实现。

## 页面承载

- 设置 → 服务器详情 → Helper：负责发现、配对、状态和管理。
- Desktop 的 Helper 卡片只显示“凭证同步”入口，点击后在二级 Modal 中选择分组并显式上传或拉取。
- 设置 → 服务器详情 → Helper → 凭证同步：iOS 在二级页面选择 M-Team 或 Mikan 后显式上传或拉取；每次覆盖前再次确认。
- Mikan 详情：“导入已出”调用一次性批量导入；“订阅”管理持续追更目标。
- 我的订阅：从 Helper 汇总活动副本与剧集状态，不以 iOS 本地集合覆盖远端。

## 凭证 Profile 边界

- Helper 是跨设备 Profile 的真相源，但不自动同步，也不在配对时隐式复制数据。
- 客户端只发送用户所选分组的已有记录；未选择或来源端缺失的记录不会被删除。
- 桌面端可同步 M-Team、Mikan、AI、OMDb 与 TMDB 配置；iOS 当前只应用 M-Team 与 Mikan，其他记录原样保留在 Helper。
- M-Team 请求仍由当前客户端直连 M-Team；Helper 不承担请求代理。
- `secret` 是分类与 UI 语义，不是字段级加密。Helper 以 `0600` 文件保存 Profile，所有已配对客户端具有读取能力。

## 已确认结论

Helper 是每台服务器的订阅与跨设备 Profile 真相。iOS 已接入多客户端凭据、显式 Profile 上传/拉取、revision 合并、持续订阅、一次性批量导入、状态、重试、目标编辑与详情回跳。
