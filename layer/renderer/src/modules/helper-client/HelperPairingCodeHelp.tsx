import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  HELPER_PAIRING_CODE_COMMAND,
  HELPER_PAIRING_CODE_JOURNAL_COMMAND,
} from './pairing-code-command'

const CommandRow = ({
  command,
  onCopy,
}: {
  command: string
  onCopy: (command: string) => void
}) => (
  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
    <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre text-xs text-text-secondary">
      {command}
    </code>
    <button
      className="shrink-0 text-text-tertiary hover:text-text"
      type="button"
      onClick={() => onCopy(command)}
    >
      <i className="i-mingcute-copy-2-line text-sm" />
    </button>
  </div>
)

export const HelperPairingCodeHelp = () => {
  const { t } = useTranslation('app')

  const copy = (command: string) => {
    void navigator.clipboard.writeText(command).then(() => {
      toast.success(t('servers.helper.pairingCodeCopied'))
    })
  }

  return (
    <details open className="group rounded-md bg-fill-secondary/40 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-text [&::-webkit-details-marker]:hidden">
        <i className="i-mingcute-down-line text-sm transition-transform duration-200 group-open:rotate-180" />
        {t('servers.helper.pairingCodeHelpTitle')}
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-text-secondary">
          {t('servers.helper.pairingCodeHelpIntro')}
        </p>
        <CommandRow command={HELPER_PAIRING_CODE_COMMAND} onCopy={copy} />
        <p className="text-xs text-text-tertiary">
          {t('servers.helper.pairingCodeHelpFallback')}
        </p>
        <CommandRow
          command={HELPER_PAIRING_CODE_JOURNAL_COMMAND}
          onCopy={copy}
        />
        <p className="text-xs text-text-tertiary">
          {t('servers.helper.pairingCodeHelpWhy')}
        </p>
      </div>
    </details>
  )
}
