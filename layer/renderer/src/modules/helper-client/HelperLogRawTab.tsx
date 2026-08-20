import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'

import { getHelperLogs } from './events-api'
import { helperLogFilePath } from './log-path'

const RAW_TAIL_LINES = 500

interface HelperLogRawTabProps {
  baseUrl: string
  token: string
}

export const HelperLogRawTab = ({ baseUrl, token }: HelperLogRawTabProps) => {
  const { t } = useTranslation('app')
  const [text, setText] = useState('')

  useEffect(() => {
    let cancelled = false
    setText('')
    getHelperLogs(baseUrl, token, RAW_TAIL_LINES)
      .then((raw) => {
        if (!cancelled) {
          setText(raw)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [baseUrl, token])

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      toast.success(t('messages.copiedToClipboard'))
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-fill-secondary/40 px-2 py-1.5 text-xs text-text-secondary">
        <span className="min-w-0 flex-1 truncate">
          {t('helper.logs.filePath')}: {helperLogFilePath()}
        </span>
        <button
          className="shrink-0 text-text-tertiary hover:text-text"
          type="button"
          onClick={() => copy(helperLogFilePath())}
        >
          <i className="i-mingcute-copy-2-line text-sm" />
        </button>
      </div>
      <div className="flex items-center justify-end">
        <Button size="sm" variant="ghost" onClick={() => copy(text)}>
          <i className="i-mingcute-copy-2-line mr-1" />
          {t('helper.logs.copyAll')}
        </Button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background p-2 font-mono text-[11px] text-text-secondary">
        {text || t('helper.logs.empty')}
      </pre>
    </div>
  )
}
