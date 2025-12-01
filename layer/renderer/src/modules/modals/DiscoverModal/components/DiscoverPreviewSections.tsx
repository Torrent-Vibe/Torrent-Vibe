import bbobHTML from '@bbob/html'
import presetHTML5 from '@bbob/preset-html5'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  CollapseCss,
  CollapseCssGroup,
} from '~/components/ui/accordion/Accordion'
import type { DiscoverPreviewDescriptionRenderer } from '~/modules/discover'

import type {
  PreviewFileItem,
  PreviewHeroData,
  PreviewLink,
  PreviewScreenshot,
  PreviewStat,
} from './discoverPreviewModel'

interface PreviewHeroProps {
  data: PreviewHeroData
}

const PreviewHeroStat = ({ stat }: { stat: PreviewStat }) => (
  <div className="rounded-lg border border-border/60 bg-fill-secondary/40 p-2.5 @[620px]:p-3 @[840px]:p-3.5">
    <span className="text-[11px] uppercase tracking-wide text-text-tertiary @[620px]:text-xs">
      {stat.label}
    </span>
    <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-text @[620px]:gap-2">
      <i className={clsx(stat.icon, 'shrink-0')} />
      <span>{stat.value}</span>
    </div>
  </div>
)

export const PreviewHero = ({ data }: PreviewHeroProps) => (
  <section className="space-y-2.5 @[620px]:grid @[620px]:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] @[620px]:items-start @[620px]:gap-x-4 @[620px]:gap-y-3 @[840px]:col-span-2">
    <div className="space-y-1 @[620px]:col-span-1">
      <h4 className="text-base font-semibold text-text select-text">
        {data.title}
      </h4>
      {data.subtitle ? (
        <p className="text-xs leading-relaxed text-text-secondary select-text">
          {data.subtitle}
        </p>
      ) : null}
    </div>

    {data.tags.length > 0 && (
      <div className="space-y-1 @[620px]:col-span-1">
        {data.tagsLabel ? (
          <span className="text-[11px] uppercase tracking-wide text-text-tertiary select-text">
            {data.tagsLabel}
          </span>
        ) : null}
        <div className="flex flex-wrap gap-1.5 @[620px]:gap-2">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-fill-secondary px-2 py-0.5 text-xs text-text-secondary select-text"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    )}

    {data.stats.length > 0 && (
      <div className="grid grid-cols-1 gap-2.5 text-xs @[420px]:grid-cols-2 @[620px]:col-span-1 @[620px]:col-start-2 @[620px]:self-start">
        {data.stats.map((stat) => (
          <PreviewHeroStat key={stat.id} stat={stat} />
        ))}
      </div>
    )}
  </section>
)

interface SectionTitleProps {
  icon?: string
  children: ReactNode
}

export const PreviewSectionTitle = ({ icon, children }: SectionTitleProps) => (
  <h5 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary @[500px]:text-xs @[840px]:text-[13px]">
    {icon ? <i className={`${icon} text-sm`} /> : null}
    <span>{children}</span>
  </h5>
)

export const PreviewOriginFile = ({
  title,
  originFileName,
}: {
  title: string
  originFileName: string
}) => (
  <section className="space-y-1.5 @[440px]:space-y-2 @[840px]:col-span-1">
    <PreviewSectionTitle icon="i-mingcute-file-line">
      {title}
    </PreviewSectionTitle>
    <p className="break-words text-xs text-text-secondary @[620px]:text-sm @[840px]:leading-relaxed">
      {originFileName}
    </p>
  </section>
)

export const PreviewLinks = ({
  title,
  links,
}: {
  title: string
  links: PreviewLink[]
}) => (
  <section className="space-y-1.5 @[440px]:space-y-2 @[840px]:col-span-1">
    <PreviewSectionTitle icon="i-mingcute-external-link-line">
      {title}
    </PreviewSectionTitle>
    <ul className="space-y-0.5 text-xs @[620px]:space-y-1 @[620px]:text-sm">
      {links.map((link) => (
        <li key={link.id}>
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 text-accent hover:underline @[620px]:gap-2.5"
          >
            <span>{link.label}</span>
            {link.rating && (
              <span className="text-text-tertiary">{link.rating}</span>
            )}
            <i className="i-mingcute-arrow-right-up-line text-xs" />
          </a>
        </li>
      ))}
    </ul>
  </section>
)

export const PreviewDescription = ({
  title,
  content,
  renderer,
}: {
  title: string
  content: string
  renderer: DiscoverPreviewDescriptionRenderer
}) => {
  const markdown = useMemo(() => content.trim(), [content])

  const shouldRenderMarkdown = renderer === 'markdown'
  const bbcodeHtml = useMemo(() => {
    if (shouldRenderMarkdown) return null
    return bbobHTML(content, presetHTML5())
  }, [content, shouldRenderMarkdown])
  if (renderer === 'bbcode' && content.trim().length === 0) {
    return null
  }

  if (shouldRenderMarkdown && markdown.length === 0) {
    return null
  }

  return (
    <section className="space-y-1.5 @[500px]:space-y-2 @[840px]:col-span-2 select-text">
      <PreviewSectionTitle icon="i-mingcute-text-line">
        {title}
      </PreviewSectionTitle>
      <div className="rounded-lg border border-border/60 bg-fill-secondary/40 p-2.5 text-sm text-text-secondary @[500px]:p-3 @[840px]:p-4 @[840px]:text-[15px]">
        {shouldRenderMarkdown ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className={'overflow-x-auto'}
            components={{
              h1: ({ node, className, ...props }) => (
                <h1
                  className={clsx(
                    'mb-2.5 text-lg font-semibold text-text',
                    className,
                  )}
                  {...props}
                />
              ),
              h2: ({ node, className, ...props }) => (
                <h2
                  className={clsx(
                    'mb-2.5 text-base font-semibold text-text',
                    className,
                  )}
                  {...props}
                />
              ),
              h3: ({ node, className, ...props }) => (
                <h3
                  className={clsx(
                    'mb-1.5 text-sm font-semibold text-text',
                    className,
                  )}
                  {...props}
                />
              ),
              p: ({ node, className, ...props }) => (
                <p
                  className={clsx(
                    'mb-2.5 leading-relaxed last:mb-0',
                    className,
                  )}
                  {...props}
                />
              ),
              ul: ({ node, className, ...props }) => (
                <ul
                  className={clsx(
                    'mb-2.5 list-disc space-y-0.5 pl-5 last:mb-0',
                    className,
                  )}
                  {...props}
                />
              ),
              ol: ({ node, className, ...props }) => (
                <ol
                  className={clsx(
                    'mb-2.5 list-decimal space-y-0.5 pl-5 last:mb-0',
                    className,
                  )}
                  {...props}
                />
              ),
              blockquote: ({ node, className, ...props }) => (
                <blockquote
                  className={clsx(
                    'mb-2.5 border-l-2 border-border/80 pl-3 text-text-secondary/90 last:mb-0',
                    className,
                  )}
                  {...props}
                />
              ),
              li: ({ node, className, ...props }) => (
                <li className={clsx('leading-relaxed', className)} {...props} />
              ),
              strong: ({ node, className, ...props }) => (
                <strong
                  className={clsx('font-semibold text-text', className)}
                  {...props}
                />
              ),
              em: ({ node, className, ...props }) => (
                <em className={clsx('italic', className)} {...props} />
              ),

              a: ({ node, className, ...props }) => (
                <a
                  className={clsx(
                    'text-accent underline underline-offset-2 hover:opacity-80',
                    className,
                  )}
                  target="_blank"
                  rel="noreferrer noopener"
                  {...props}
                />
              ),
              img: ({ node, className, ...props }) => (
                <img
                  className={clsx('my-2 max-w-full', className)}
                  {...props}
                  alt={props.alt || ''}
                />
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        ) : (
          <div className="space-y-2 overflow-x-auto leading-relaxed whitespace-pre break-all [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border/80 [&_blockquote]:pl-3 [&_strong]:text-text">
            <div dangerouslySetInnerHTML={{ __html: bbcodeHtml! }} />
          </div>
        )}
      </div>
    </section>
  )
}

export const PreviewFiles = ({
  title,
  files,
  overflowLabel,
}: {
  title: string
  files: PreviewFileItem[]
  overflowLabel?: string | null
}) => (
  <section className="space-y-1.5 @[440px]:space-y-2 @[840px]:col-span-2">
    <PreviewSectionTitle icon="i-mingcute-folder-3-line">
      {title}
    </PreviewSectionTitle>
    <div className="space-y-1 @[620px]:space-y-1.5">
      <ul className="grid gap-1 text-xs text-text-tertiary @[620px]:grid-cols-2 @[840px]:gap-1.5">
        {files.slice(0, 10).map((file, index) => (
          <li
            key={`${file.name}-${index}`}
            className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border/60 bg-fill-secondary/30 px-2.5 py-1.5 @[400px]:flex-row @[400px]:items-center @[400px]:justify-between @[400px]:gap-1.5 @[620px]:px-3 @[620px]:py-2"
          >
            <span className="truncate text-text-secondary">{file.name}</span>
            <span className="text-text">{file.sizeLabel}</span>
          </li>
        ))}
      </ul>
      {overflowLabel ? (
        <p className="text-[11px] text-text-tertiary @[620px]:text-xs">
          {overflowLabel}
        </p>
      ) : null}
    </div>
  </section>
)

export const PreviewScreenshots = ({
  title,
  screenshots,
}: {
  title: string
  screenshots: PreviewScreenshot[]
}) => (
  <section className="space-y-1.5 @[500px]:space-y-2 @[840px]:col-span-2">
    <PreviewSectionTitle icon="i-mingcute-landscape-line">
      {title}
    </PreviewSectionTitle>
    <div className="grid grid-cols-1 gap-1.5 @[440px]:grid-cols-2 @[720px]:grid-cols-3 @[840px]:gap-2">
      {screenshots.slice(0, 4).map((item, index) => (
        <a
          key={`${item.url}-${index}`}
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          className="group relative block aspect-[4/3] overflow-hidden rounded-md border border-border/50 @[720px]:rounded-lg"
        >
          <img
            src={item.url}
            alt={item.alt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  </section>
)

export const PreviewMediainfo = ({
  title,
  mediainfo,
}: {
  title: string
  mediainfo: string
}) => (
  <CollapseCssGroup>
    <CollapseCss
      title={
        <div className="px-3.5 h-8 flex items-center text-xs font-semibold uppercase tracking-wide text-text-tertiary @[620px]:px-4 @[620px]:py-2">
          <span className="inline-flex items-center gap-1.5">
            <i className="i-mingcute-terminal-box-line text-sm" />
            <span>{title}</span>
          </span>
        </div>
      }
      className="@[840px]:col-span-2 overflow-hidden rounded-lg border border-border/60 bg-fill-secondary/30 @[620px]:rounded-xl"
    >
      <pre className="whitespace-pre-wrap px-2 text-xs leading-relaxed text-text-secondary">
        {mediainfo}
      </pre>
    </CollapseCss>
  </CollapseCssGroup>
)
