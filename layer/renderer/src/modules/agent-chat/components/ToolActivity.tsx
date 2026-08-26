import type { AgentChatActivity } from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'

import { cn } from '~/lib/cn'
import { formatBytes, formatSpeed } from '~/lib/format'

const statusIcon: Record<AgentChatActivity['status'], string> = {
  failed: 'i-mingcute-close-circle-line text-red',
  running: 'i-mingcute-loading-3-line animate-spin text-accent',
  succeeded: 'i-mingcute-check-circle-line text-green',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const asList = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const textOf = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null

const numberOf = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const More = ({ count }: { count: number }) => {
  const { t } = useTranslation()
  if (count <= 0) {
    return null
  }
  return (
    <p className="pt-1 text-[10px] text-text-tertiary">
      {t('agent.result.more', { count })}
    </p>
  )
}

const TorrentRows = ({ payload }: { payload: unknown }) => {
  const { t } = useTranslation()
  const record = isRecord(payload) ? payload : null
  const torrents = asList<Record<string, unknown>>(
    record?.torrents ?? record?.items,
  ).filter(isRecord)
  const visible = torrents.slice(0, 8)

  if (visible.length === 0) {
    return null
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-text-tertiary">
        {t('agent.result.torrents', {
          count: numberOf(record?.count) ?? torrents.length,
        })}
      </p>
      {visible.map((torrent) => {
        const name = textOf(torrent.name) ?? t('agent.result.untitled')
        const state = textOf(torrent.state)
        const category = textOf(torrent.category)
        const progress = numberOf(torrent.progress)
        const size = numberOf(torrent.size)
        const downloadSpeed = numberOf(torrent.downloadSpeed)
        return (
          <div className="min-w-0" key={textOf(torrent.hash) ?? name}>
            <p className="truncate text-text" title={name}>
              {name}
            </p>
            <p className="truncate text-[10px] text-text-tertiary">
              {[
                state,
                category,
                progress === null ? null : `${Math.round(progress * 100)}%`,
                size === null ? null : formatBytes(size),
                downloadSpeed ? formatSpeed(downloadSpeed) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )
      })}
      <More count={torrents.length - visible.length} />
    </div>
  )
}

const AuditRows = ({ payload }: { payload: unknown }) => {
  const { t } = useTranslation()
  const record = isRecord(payload) ? payload : null
  const issues = asList<Record<string, unknown>>(record?.issues).filter(
    isRecord,
  )
  const roots = asList<unknown>(record?.observedRoots).filter(
    (item): item is string => typeof item === 'string',
  )
  const visible = issues.slice(0, 8)

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-text-tertiary">
        {t('agent.result.issues', { count: issues.length })}
        {numberOf(record?.scanned) !== null
          ? ` · ${t('agent.result.scanned', { count: record?.scanned })}`
          : ''}
      </p>
      {roots.length > 0 && (
        <p
          className="truncate text-[10px] text-text-tertiary"
          title={roots.join(', ')}
        >
          {t('agent.result.roots')}: {roots.slice(0, 3).join(' · ')}
        </p>
      )}
      {visible.map((issue) => (
        <div
          className="min-w-0"
          key={
            textOf(issue.hash) ??
            textOf(issue.detail) ??
            textOf(issue.name) ??
            String(issue.kind)
          }
        >
          <p className="truncate text-text">
            {textOf(issue.name) ?? t('agent.result.untitled')}
          </p>
          <p className="truncate text-[10px] text-text-tertiary">
            {[textOf(issue.kind), textOf(issue.detail)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ))}
      <More count={issues.length - visible.length} />
    </div>
  )
}

const MetadataRows = ({ payload }: { payload: unknown }) => {
  const { t } = useTranslation()
  const record = isRecord(payload) ? payload : null
  const items = asList<Record<string, unknown>>(
    record?.results ?? record?.items,
  ).filter(isRecord)
  const visible = items.slice(0, 8)

  if (visible.length === 0) {
    return null
  }

  return (
    <div className="space-y-1.5">
      {record?.previewOnly ? (
        <p className="text-[10px] text-text-tertiary">
          {t('agent.result.previewOnly')}
        </p>
      ) : null}
      {visible.map((item) => {
        const metadata = isRecord(item.metadata) ? item.metadata : null
        const titleRecord = isRecord(metadata?.title) ? metadata.title : null
        const tmdb = isRecord(metadata?.tmdb) ? metadata.tmdb : null
        const title =
          textOf(titleRecord?.canonicalTitle) ??
          textOf(tmdb?.title) ??
          textOf(item.name) ??
          t('agent.result.untitled')
        const confidence = numberOf(
          isRecord(metadata?.confidence) ? metadata.confidence.overall : null,
        )
        return (
          <div className="min-w-0" key={textOf(item.hash) ?? title}>
            <p className="truncate text-text" title={title}>
              {title}
            </p>
            <p className="truncate text-[10px] text-text-tertiary">
              {[
                textOf(metadata?.mediaType),
                confidence === null
                  ? null
                  : t('agent.result.confidence', {
                      value: `${Math.round(confidence * 100)}%`,
                    }),
                textOf(item.name),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )
      })}
      <More count={items.length - visible.length} />
    </div>
  )
}

const TmdbRows = ({ payload }: { payload: unknown }) => {
  const { t } = useTranslation()
  const record = isRecord(payload) ? payload : null
  const data = isRecord(record?.data) ? record.data : null
  const results = asList<Record<string, unknown>>(record?.results).filter(
    isRecord,
  )
  const items = data ? [data] : results
  const visible = items.slice(0, 6)

  if (visible.length === 0) {
    return (
      <p className="text-[10px] text-text-tertiary">
        {t('agent.result.empty')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {visible.map((item) => {
        const title = textOf(item.title) ?? t('agent.result.untitled')
        const poster = textOf(item.posterUrl)
        const overview = textOf(item.overview)
        return (
          <div className="flex gap-2" key={String(item.id ?? title)}>
            {poster ? (
              <img
                alt=""
                className="size-12 shrink-0 rounded-md object-cover"
                src={poster}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-text" title={title}>
                {title}
              </p>
              <p className="truncate text-[10px] text-text-tertiary">
                {[
                  textOf(item.mediaType),
                  textOf(item.releaseDate),
                  numberOf(item.rating) === null
                    ? null
                    : t('agent.result.rating', { value: item.rating }),
                  numberOf(item.runtimeMinutes) === null
                    ? null
                    : t('agent.result.runtime', { value: item.runtimeMinutes }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {overview ? (
                <p className="mt-0.5 line-clamp-2 text-[10px] text-text-tertiary">
                  {overview}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
      <More count={items.length - visible.length} />
    </div>
  )
}

const SearchRows = ({ payload }: { payload: unknown }) => {
  const { t } = useTranslation()
  const record = isRecord(payload) ? payload : null
  const results = asList<Record<string, unknown>>(record?.results).filter(
    isRecord,
  )
  const visible = results.slice(0, 6)

  if (visible.length === 0) {
    return (
      <p className="text-[10px] text-text-tertiary">
        {t('agent.result.empty')}
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {visible.map((item) => {
        const title = textOf(item.title) ?? t('agent.result.untitled')
        const url = textOf(item.url)
        return (
          <div className="min-w-0" key={url ?? title}>
            {url ? (
              <a
                className="truncate text-accent underline-offset-2 hover:underline"
                href={url}
                rel="noreferrer"
                target="_blank"
              >
                {title}
              </a>
            ) : (
              <p className="truncate text-text">{title}</p>
            )}
            {textOf(item.snippet) ? (
              <p className="line-clamp-2 text-[10px] text-text-tertiary">
                {item.snippet as string}
              </p>
            ) : null}
          </div>
        )
      })}
      <More count={results.length - visible.length} />
    </div>
  )
}

const OutputBlock = ({ payload }: { payload: unknown }) => {
  const output = isRecord(payload)
    ? (textOf(payload.output) ?? textOf(payload.text))
    : typeof payload === 'string'
      ? payload
      : null
  if (!output) {
    return null
  }
  return (
    <pre className="max-h-48 overflow-auto font-mono text-[10px] leading-4 whitespace-pre-wrap break-all text-text-tertiary">
      {output}
    </pre>
  )
}

const isResultTool = (toolName: string) =>
  toolName === 'query_torrents' ||
  toolName === 'inspect_torrents' ||
  toolName === 'audit_download_library' ||
  toolName === 'resolve_media_metadata' ||
  toolName === 'preview_download_organization' ||
  toolName === 'tmdbSearch' ||
  toolName === 'tmdbDetails' ||
  toolName === 'webSearch'

const renderPayload = (activity: AgentChatActivity) => {
  switch (activity.toolName) {
    case 'query_torrents':
    case 'inspect_torrents': {
      return <TorrentRows payload={activity.payload} />
    }
    case 'audit_download_library': {
      return <AuditRows payload={activity.payload} />
    }
    case 'resolve_media_metadata':
    case 'preview_download_organization': {
      return <MetadataRows payload={activity.payload} />
    }
    case 'tmdbSearch':
    case 'tmdbDetails': {
      return <TmdbRows payload={activity.payload} />
    }
    case 'webSearch': {
      return <SearchRows payload={activity.payload} />
    }
    case 'bash':
    case 'read_skill': {
      return <OutputBlock payload={activity.payload} />
    }
    case 'prepare_torrent_operation': {
      return null
    }
    default: {
      return activity.summary ? (
        <pre className="font-mono text-[10px] whitespace-pre-wrap break-all text-text-tertiary">
          {activity.summary}
        </pre>
      ) : null
    }
  }
}

export const ToolActivity = ({ activity }: { activity: AgentChatActivity }) => {
  const body = activity.status === 'running' ? null : renderPayload(activity)
  const asResult = Boolean(body) && isResultTool(activity.toolName)

  if (asResult) {
    return (
      <div className="min-w-0 space-y-1.5 text-xs">
        <p className="flex items-center gap-2 text-text-tertiary">
          <i className={cn('shrink-0', statusIcon[activity.status])} />
          <span className="min-w-0 truncate">{activity.label}</span>
        </p>
        {body}
      </div>
    )
  }

  return (
    <details className="group min-w-0 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-text-secondary">
        <i className={cn('shrink-0', statusIcon[activity.status])} />
        <span className="min-w-0 flex-1 truncate">{activity.label}</span>
        {body ? (
          <i className="i-mingcute-down-line shrink-0 text-text-quaternary transition-transform group-open:rotate-180" />
        ) : null}
      </summary>
      {body ? <div className="pl-6 pb-1.5">{body}</div> : null}
    </details>
  )
}
