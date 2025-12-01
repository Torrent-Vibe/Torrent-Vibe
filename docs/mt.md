下面是一份 Markdown 格式的 **M-Team 搜索 + 种子详情 + 下载直链** API 文档，精简字段，方便插件直接对接与展示预览。

---

# M-Team 搜索 & 详情 & 下载 API 文档

下面的端点及字段，适用于你的插件做：搜索种子 → 查看详情 → 获取下载直链。

---

## 通用说明

* 基础路径：`https://api.m-team.cc/api/`（或 `api.m-team.io`）
* 鉴权：请求头需含 `x-api-key: <你的 API 密钥>`
* 注意：不同端点 `Content-Type` 与请求体格式可能不同；文档与实测可能有差异

---

## 接口一：搜索种子（列表）

* **方法**：POST
* **路径**：`/torrent/search`
* **Content-Type**：`application/json`

### 请求体示例字段

```json
{
  "torrentSearch": {
    "keyword": "搜索关键词",
    "categories": [],           // 分类 ID 数组，可空表示所有分类
    "pageNumber": 1,            // 页号，从 1 开始
    "pageSize": 20,             // 每页数量
    "mode": "normal",           // 模式如 normal / movie / music / adult / etc
    "discount": "FREE",         // 可选，例如 FREE 表示限免资源
    "visible": 1                // 可见性标志，通常传 1
  }
}
```

### 响应（列表项）重点字段

| 字段名                      | 类型              | 说明                                              |
| ------------------------ | --------------- | ----------------------------------------------- |
| `id`                     | number          | 种子 ID，用于取详情与生成直链                                |
| `title`                  | string          | 种子标题                                            |
| `size`                   | number 或 string | 文件大小（字节），有的返回为字符串                               |
| `createDate`             | string 或 number | 上传时间或创建时间                                       |
| `status.seeders`         | number 或 string | 做种数                                             |
| `status.leechers`        | number 或 string | 下载数                                             |
| `status.snatches`        | number 或 string | 完成数                                             |
| `status.discount`        | string          | 折扣状态，如 FREE / PERCENT\_50 / \_2X / \_2X\_FREE 等 |
| `status.discountEndTime` | string 或 null   | 折扣结束时间，如活动限时，可能为空                               |

---

## 接口二：种子详情预览

* **方法**：POST
* **路径**：`/torrent/detail`
* **Content-Type**：`application/x-www-form-urlencoded`

### 请求参数

* `id`：number 或字符串 — 搜索结果中的 `id`

### 响应重点字段（在 `data` 对象内）

| 字段名                           | 类型              | 说明        |
| ----------------------------- | --------------- | --------- |
| `data.status.seeders`         | number 或 string | 实时做种数     |
| `data.status.leechers`        | number 或 string | 实时下载数     |
| `data.status.snatches`        | number 或 string | 完成数       |
| `data.status.discount`        | string          | 当前种子的折扣状态 |
| `data.status.discountEndTime` | string 或 null   | 折扣结束时间    |

---

## 接口三：获取下载直链（.torrent 文件）

* **方法**：POST
* **路径**：`/torrent/genDlToken`
* **Content-Type**：`application/x-www-form-urlencoded`

### 请求参数

* `id`：number 或字符串 — 种子 ID（同前）

### 响应字段

| 字段名       | 类型     | 说明                      |
| --------- | ------ | ----------------------- |
| `message` | string | 成功返回通常为 `"SUCCESS"`     |
| `data`    | string | 临时 .torrent 文件的下载直链 URL |

---

## 接口四：字幕（可选）

如果你想在详情页展示字幕信息，这两个接口可能会用到：

* **字幕列表**：`POST /subtitle/list`，参数 `id=<种子ID>`，返回字幕条目（如字幕 `filename`、`id` 等）
* **字幕下载**：`GET /subtitle/dl?id=<字幕ID>`，带 `x-api-key` 头，返回字幕文件或压缩包

---

## 字段枚举 &折扣状态说明（供展示与筛选）

常见的 `discount` 状态可能包括但不限于：

* `FREE` — 下载不计流量
* `PERCENT_50` — 下载计流量的一半
* `PERCENT_30` — 下载计流量的三成
* `_2X` — 上传奖励 ×2
* `_2X_FREE` — 上传 ×2 + 下载不计流量
* `_2X_PERCENT_50` — 上传 ×2 + 下载计流量一半

---

## 完整接口汇总表

| 名称              | 方法   | 路径                    | 入参                                                                                                   | 出参重点                                                                                                    |
| --------------- | ---- | --------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 搜索种子            | POST | `/torrent/search`     | JSON：`torrentSearch` 包含 `keyword`、`categories`、`pageNumber`、`pageSize`、`mode`、`discount?`、`visible?` | 列表：每条含 `id`, `title`, `size`, `createDate`, `status.seeders/leechers/snatches/discount/discountEndTime` |
| 查看详情            | POST | `/torrent/detail`     | 表单：`id`                                                                                              | `data.status.seeders/leechers/snatches/discount/discountEndTime`                                        |
| 生成下载 - .torrent | POST | `/torrent/genDlToken` | 表单：`id`                                                                                              | `data` 为可用 .torrent 下载 URL                                                                              |
| 字幕列表（可选）        | POST | `/subtitle/list`      | 表单：`id`                                                                                              | 字幕条目（含 `id`, `filename` 等）                                                                              |
| 字幕下载（可选）        | GET  | `/subtitle/dl`        | Query：`id=<字幕ID>`                                                                                    | 字幕文件或 ZIP 包                                                                                             |
 


 下面是按照我能从社区开源项目里汇总到的字段，用 TypeScript interfaces 来表示 `接口一：/torrent/search` 与 `接口二：/torrent/detail` 的请求体与响应体结构。因为官方文档未完全公开所有字段，某些 Optional（可选）字段可能在你实际测试中不存在／命名略有差异，请做好兼容性判断。

---

```ts
// 接口一：/torrent/search

interface TorrentSearchRequest {
  torrentSearch: {
    keyword?: string;         // 搜索关键词
    categories?: number[];    // 分类 ID 列表（空数组表示所有分类）
    pageNumber: number;       // 页码，从 0 开始
    pageSize: number;         // 每页数量
    mode?: string;            // 模式，如 "normal" / "movie" / "adult" / etc.
    discount?: string;        // 折扣状态过滤，比如 "FREE"
    visible?: number;          // 可见性标志，一般传 1
  };
}

interface TorrentSearchItemStatus {
  seeders: number | string;
  leechers: number | string;
  snatches: number | string;
  discount?: string;
  discountEndTime?: string | null;
}

interface TorrentSearchItem {
  id: number;
  title: string;
  size: number | string;
  createDate: string | number;
  status: TorrentSearchItemStatus;
  // 以下字段可能可有可无
  // category?: number;
  // cover?: string;
  // smallDescr?: string;
}

interface TorrentSearchResponse {
  // 通常返回结构里会有 status/message/data 这样的包层
  message: string;
  data: {
    data: TorrentSearchItem[];   // 注意有些实现里 data.data 是列表
    total?: number;               // 总记录数（如果有的话）
    pageNumber: number;
    pageSize: number;
  };
}
```

---

```ts
// 接口二：/torrent/detail

interface TorrentDetailRequest {
  id: number;
}

interface TorrentDetailStatus {
  seeders: number | string;
  leechers: number | string;
  snatches: number | string;
  discount?: string;
  discountEndTime?: string | null;
}

interface TorrentDetailData {
  id: number;                   // 种子 ID
  title?: string;
  size?: number | string;
  createDate?: string | number;
  status: TorrentDetailStatus;
  // 可选的补充字段（若 detail 接口返回）：
  // description?: string;
  // fileList?: { name: string; size: number | string }[];
  // screenshotUrls?: string[];
}

interface TorrentDetailResponse {
  message: string;
  data: TorrentDetailData;
}
```

