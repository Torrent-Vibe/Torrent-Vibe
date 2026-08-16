import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'

import { helperInstallCommand } from './install-command'

export const HelperInstallSnippet = () => {
  const { t } = useTranslation('app')
  const [arch, setArch] = useState<'amd64' | 'arm64'>('amd64')
  const command = helperInstallCommand({ arch })

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text">
        {t('servers.helper.installTitle')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={arch === 'amd64' ? 'primary' : 'secondary'}
          onClick={() => setArch('amd64')}
        >
          {t('servers.helper.archAmd64')}
        </Button>
        <Button
          size="sm"
          variant={arch === 'arm64' ? 'primary' : 'secondary'}
          onClick={() => setArch('arm64')}
        >
          {t('servers.helper.archArm64')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(command).then(() => {
              toast.success(t('servers.helper.installCopied'))
            })
          }}
        >
          {t('servers.helper.installCopy')}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md bg-fill-secondary p-2 text-[11px] text-text-secondary">
        {command}
      </pre>
    </div>
  )
}
