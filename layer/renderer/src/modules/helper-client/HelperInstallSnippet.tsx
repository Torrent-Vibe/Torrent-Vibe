import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { helperInstallCommand } from './install-command'

export const HelperInstallSnippet = () => {
  const { t } = useTranslation('app')

  const copy = (arch: 'amd64' | 'arm64') => {
    void navigator.clipboard
      .writeText(helperInstallCommand({ arch }))
      .then(() => {
        toast.success(t('servers.helper.installCopied'))
      })
  }

  return (
    <p className="text-xs text-text-tertiary">
      {t('servers.helper.installHint')}
      {' '}
      <button
        type="button"
        className="text-text-secondary underline-offset-2 hover:text-text hover:underline"
        onClick={() => copy('amd64')}
      >
        {t('servers.helper.archAmd64')}
      </button>
      {' · '}
      <button
        type="button"
        className="text-text-secondary underline-offset-2 hover:text-text hover:underline"
        onClick={() => copy('arm64')}
      >
        {t('servers.helper.archArm64')}
      </button>
    </p>
  )
}
