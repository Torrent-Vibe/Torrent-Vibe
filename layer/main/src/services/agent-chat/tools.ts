import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'
import type { AgentChatContext, AgentOperationPlan } from '@torrent-vibe/shared'

import { TorrentAiEngine } from '../torrent-ai'
import { buildReadSkillTool } from './agentTools/skillTool'
import { loadAgentChatSkillIndex } from './skills'
import type { AgentTorrentOperations } from './torrent-operations'

const textResult = <T>(value: unknown, details: T): AgentToolResult<T> => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  details,
})

const querySchema = Type.Object({
  completedOnly: Type.Optional(Type.Boolean()),
  query: Type.Optional(Type.String()),
  states: Type.Optional(Type.Array(Type.String())),
  hashes: Type.Optional(Type.Array(Type.String())),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
})

const inspectSchema = Type.Object({
  hashes: Type.Optional(Type.Array(Type.String(), { maxItems: 50 })),
})

const auditSchema = Type.Object({
  hashes: Type.Optional(Type.Array(Type.String())),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
})

const operationHashes = Type.Optional(
  Type.Array(Type.String(), { maxItems: 50 }),
)

const operationSchema = Type.Union([
  Type.Object({
    action: Type.Literal('add_torrent'),
    category: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    savePath: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
    sources: Type.Array(Type.String({ minLength: 1, maxLength: 4096 }), {
      minItems: 1,
      maxItems: 10,
    }),
    startPaused: Type.Optional(Type.Boolean()),
  }),
  Type.Object({
    action: Type.Union([Type.Literal('pause'), Type.Literal('resume')]),
    hashes: operationHashes,
  }),
  Type.Object({
    action: Type.Literal('set_category'),
    category: Type.String({ minLength: 1, maxLength: 100 }),
    hashes: operationHashes,
  }),
  Type.Object({
    action: Type.Union([Type.Literal('add_tags'), Type.Literal('remove_tags')]),
    hashes: operationHashes,
    tags: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), {
      minItems: 1,
      maxItems: 20,
    }),
  }),
  Type.Object({
    action: Type.Union([
      Type.Literal('set_download_limit'),
      Type.Literal('set_upload_limit'),
    ]),
    hashes: operationHashes,
    limitBytesPerSecond: Type.Integer({ minimum: 0 }),
  }),
  Type.Object({
    action: Type.Literal('set_share_limits'),
    hashes: operationHashes,
    seedingTimeLimitMinutes: Type.Optional(
      Type.Union([
        Type.Literal(-2),
        Type.Literal(-1),
        Type.Integer({ minimum: 0 }),
      ]),
    ),
    shareRatioLimit: Type.Optional(
      Type.Union([
        Type.Literal(-2),
        Type.Literal(-1),
        Type.Number({ minimum: 0 }),
      ]),
    ),
  }),
  Type.Object({
    action: Type.Literal('recheck'),
    hashes: operationHashes,
    completedOnly: Type.Optional(Type.Boolean()),
    states: Type.Optional(Type.Array(Type.String())),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  }),
  Type.Object({
    action: Type.Literal('reannounce'),
    hashes: operationHashes,
  }),
  Type.Object({
    action: Type.Literal('rename_torrent'),
    hashes: Type.Optional(
      Type.Array(Type.String(), { minItems: 1, maxItems: 1 }),
    ),
    newName: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
    renames: Type.Optional(
      Type.Array(
        Type.Object({
          hash: Type.String({ minLength: 1 }),
          newName: Type.String({ minLength: 1, maxLength: 255 }),
        }),
        { minItems: 1, maxItems: 50 },
      ),
    ),
  }),
  Type.Object({
    action: Type.Literal('move_torrent'),
    hashes: operationHashes,
    savePath: Type.String({ minLength: 1, maxLength: 4096 }),
  }),
  Type.Object({
    action: Type.Literal('remove_torrent'),
    deleteFiles: Type.Boolean(),
    hashes: operationHashes,
  }),
])

const metadataSchema = Type.Object({
  forceRefresh: Type.Optional(Type.Boolean()),
  hashes: Type.Optional(Type.Array(Type.String(), { maxItems: 10 })),
})

const organizationPreviewSchema = Type.Object({
  forceRefresh: Type.Optional(
    Type.Boolean({
      description:
        'Run full media analysis for this page. Omit for a fast cache-only preview.',
    }),
  ),
  hashes: Type.Optional(Type.Array(Type.String(), { maxItems: 10 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
})

const take = <T>(items: T[] | null | undefined, limit = 20) =>
  items?.slice(0, limit) ?? null

const projectMetadata = (
  result: Awaited<ReturnType<TorrentAiEngine['analyzeName']>>,
) =>
  result.ok && result.metadata
    ? {
        confidence: result.metadata.confidence.overall,
        keywords: take(result.metadata.keywords),
        mediaType: result.metadata.mediaType,
        normalizedName: result.metadata.normalizedName,
        technical: {
          ...result.metadata.technical,
          audio: take(result.metadata.technical.audio, 10),
          otherTags: take(result.metadata.technical.otherTags, 10),
        },
        title: {
          ...result.metadata.title,
          episodeNumbers: take(result.metadata.title.episodeNumbers),
          extraInfo: take(result.metadata.title.extraInfo),
        },
        tmdb: result.metadata.tmdb
          ? {
              id: result.metadata.tmdb.id,
              mediaType: result.metadata.tmdb.mediaType,
              title: result.metadata.tmdb.title,
            }
          : null,
      }
    : null

export const buildAgentChatTools = (input: {
  context: AgentChatContext
  operations: AgentTorrentOperations
  onPlan: (plan: AgentOperationPlan) => void
  scopeKey: string | null
  userMessages: string[]
}): AgentTool[] => {
  const resolveTorrentMetadata = async (
    torrent: Awaited<ReturnType<typeof input.operations.query>>[number],
    forceRefresh?: boolean,
    cachedOnly = false,
  ) => {
    const fileTree = await input.operations.files(torrent.hash, input.scopeKey)
    const engine = TorrentAiEngine.getInstance()
    const result =
      cachedOnly && !forceRefresh
        ? await engine.lookupCached({
            hash: torrent.hash,
            rawName: torrent.name,
          })
        : await engine.analyzeName({
            fileList: fileTree.files.map(({ path, size }) => ({ path, size })),
            forceRefresh,
            hash: torrent.hash,
            rawName: torrent.name,
          })
    return {
      category: torrent.category,
      error: result.error,
      fileCount: fileTree.total,
      hash: torrent.hash,
      metadata: projectMetadata(result),
      name: torrent.name,
      ok: result.ok,
      savePath: torrent.savePath,
    }
  }

  const queryTorrents: AgentTool<typeof querySchema> = {
    name: 'query_torrents',
    label: 'Query torrents',
    description:
      'Read the active qBittorrent queue. Filter by name/category/tag text, exact states, hashes, or completed downloads only. Results are bounded and pageable summaries.',
    parameters: querySchema,
    execute: async (_id, params) => {
      const torrents = await input.operations.query(params, input.scopeKey)
      return textResult(
        { count: torrents.length, torrents },
        { count: torrents.length },
      )
    },
  }

  const inspectTorrents: AgentTool<typeof inspectSchema> = {
    name: 'inspect_torrents',
    label: 'Inspect selected torrents',
    description:
      'Read detailed queue summaries for explicit hashes. When hashes are omitted, inspect the torrents currently selected in the UI.',
    parameters: inspectSchema,
    execute: async (_id, params) => {
      const hashes = params.hashes?.length
        ? params.hashes
        : input.context.selectedTorrentHashes
      const torrents = await input.operations.query(
        { hashes, limit: 50 },
        input.scopeKey,
      )
      return textResult(
        { count: torrents.length, torrents },
        { count: torrents.length },
      )
    },
  }

  const auditDownloadLibrary: AgentTool<typeof auditSchema> = {
    name: 'audit_download_library',
    label: 'Audit download library',
    description:
      'Read-only scan of the qBittorrent queue for missing files, duplicate names, path/category mismatches, inconsistent season-folder layout, helper-managed (tv-mikan:) tags, and uncategorized torrents. Returns observed save-path roots, counts, and bounded issues. Does not rename, move, or delete. No filesystem access.',
    parameters: auditSchema,
    execute: async (_id, params) => {
      const result = await input.operations.audit(params, input.scopeKey)
      return textResult(result, { issueCount: result.issues.length })
    },
  }

  const resolveMediaMetadata: AgentTool<typeof metadataSchema> = {
    name: 'resolve_media_metadata',
    label: 'Resolve media metadata',
    description:
      'Identify the media represented by up to 10 explicit or currently selected torrents using Torrent Vibe metadata analysis. This is read-only and may use cached results.',
    parameters: metadataSchema,
    execute: async (_id, params) => {
      const hashes = params.hashes?.length
        ? params.hashes
        : input.context.selectedTorrentHashes
      if (hashes.length === 0) {
        throw new Error('Select at least one torrent to resolve metadata')
      }
      if (hashes.length > 10) {
        throw new Error('Metadata resolution supports at most 10 torrents')
      }
      const torrents = await input.operations.query(
        { hashes, limit: 10 },
        input.scopeKey,
      )
      const results = await Promise.all(
        torrents.map((torrent) =>
          resolveTorrentMetadata(torrent, params.forceRefresh),
        ),
      )
      return textResult(
        { count: results.length, results },
        { count: results.length },
      )
    },
  }

  const previewDownloadOrganization: AgentTool<
    typeof organizationPreviewSchema
  > = {
    name: 'preview_download_organization',
    label: 'Preview download organization',
    description:
      'Read completed downloads and their bounded qBittorrent file trees, then look up cached media metadata for a fast organization preview. Set forceRefresh only when the user explicitly asks to run full media analysis. Use explicit hashes, the current UI selection, or offset/limit pagination across the completed library. This never renames, moves, categorizes, or deletes anything.',
    parameters: organizationPreviewSchema,
    execute: async (_id, params) => {
      const hashes = params.hashes?.length
        ? params.hashes
        : input.context.selectedTorrentHashes
      if (hashes.length > 10) {
        throw new Error('Organization preview supports at most 10 torrents')
      }

      const limit = hashes.length || params.limit || 5
      const offset = hashes.length ? 0 : params.offset || 0
      const torrents = await input.operations.query(
        {
          completedOnly: true,
          ...(hashes.length ? { hashes } : {}),
          limit: hashes.length ? limit : limit + 1,
          offset,
        },
        input.scopeKey,
      )
      const hasMore = !hashes.length && torrents.length > limit
      const page = torrents.slice(0, limit)
      const items = await Promise.all(
        page.map((torrent) =>
          resolveTorrentMetadata(torrent, params.forceRefresh, true),
        ),
      )

      return textResult(
        {
          completedOnly: true,
          count: items.length,
          excludedCount: hashes.length ? hashes.length - items.length : 0,
          hasMore,
          items,
          nextOffset: hasMore ? offset + items.length : null,
          offset,
          previewOnly: true,
        },
        { count: items.length, hasMore, offset },
      )
    },
  }

  const prepareOperation: AgentTool<typeof operationSchema> = {
    name: 'prepare_torrent_operation',
    label: 'Prepare torrent operation',
    description:
      'Prepare, but do not execute, adding a user-provided magnet or HTTP(S) torrent URL, pause, resume, category, tag, speed/share limit, recheck, reannounce, qBittorrent rename, save-location, or removal operations. Add sources must be copied exactly from a user message; savePath and category are optional, and startPaused defaults to false. Removal requires an explicit deleteFiles choice; true also asks qBittorrent to delete downloaded data and requires a second final UI confirmation. Rename accepts either a single torrent with newName, or renames: [{ hash, newName }] for 1 to 50 per-target names. Recheck may target explicit hashes or completedOnly/states filters (cap 50; page with offset). Save paths must be absolute paths on the qBittorrent server. Speed limits use bytes per second (0 unlimited). Share limits use -2 for global and -1 for unlimited. The user must review and confirm the returned plan in the UI.',
    parameters: operationSchema,
    executionMode: 'sequential',
    execute: async (_id, params) => {
      const plan =
        params.action === 'add_torrent'
          ? await input.operations.prepareAdd(
              params,
              input.userMessages,
              input.scopeKey,
              input.context.activeServerName,
            )
          : await input.operations.prepare(
              params,
              params.action === 'rename_torrent' && params.renames
                ? params.renames.map((entry) => entry.hash)
                : params.hashes?.length
                  ? params.hashes
                  : params.action === 'recheck' &&
                      (params.completedOnly || (params.states?.length ?? 0) > 0)
                    ? []
                    : input.context.selectedTorrentHashes,
              input.scopeKey,
            )
      input.onPlan(plan)
      return textResult(
        {
          approvalRequired: true,
          plan,
          instruction:
            'Tell the user the plan is ready for review. Do not claim that it has executed.',
        },
        { plan },
      )
    },
  }

  return [
    queryTorrents,
    inspectTorrents,
    auditDownloadLibrary,
    resolveMediaMetadata,
    previewDownloadOrganization,
    prepareOperation,
    buildReadSkillTool(loadAgentChatSkillIndex()),
  ]
}
