import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Spring } from '~/lib/spring'

import { InputSourceSection } from '../components/InputSourceSection'
import { SettingsSection } from '../components/SettingsSection'
import type { AddTorrentModalSharedProps } from '../shared/types'

export const AddTorrentModalDesktop = ({
  formData,
  handlers,
  categories,
  isLoading,
  handleSubmit,
  isFormValid,
}: Omit<
  AddTorrentModalSharedProps,
  | 'dismiss'
  | 'initialFiles'
  | 'initialMagnetLinks'
  | 'setFormData'
  | 'resetFormData'
  | 'setIsLoading'
>) => {
  const { t } = useTranslation()

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <i className="i-mingcute-add-line text-white text-sm" />
          </div>
          {t('modals.addTorrent.titlePlural')}
        </DialogTitle>
        <DialogDescription className="text-text-secondary">
          {t('modals.addTorrent.description')}
        </DialogDescription>
      </DialogHeader>

      <DialogClose />

      <form
        onSubmit={handleSubmit}
        className="min-w-0 pt-2 flex-1 flex flex-col min-h-0"
      >
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={Spring.presets.smooth}
          className="min-w-0 flex-1 flex flex-col min-h-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
            {/* Left side - Input area */}
            <InputSourceSection formData={formData} handlers={handlers} />

            {/* Right side - Settings area */}
            <SettingsSection
              formData={formData}
              handlers={handlers}
              categories={categories}
            />
          </div>
        </m.div>
      </form>

      <DialogFooter>
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-full inline-block"
            disabled={isLoading}
          >
            {t('buttons.cancel')}
          </Button>
        </DialogClose>
        <Button
          size="sm"
          type="submit"
          variant="primary"
          onClick={handleSubmit}
          disabled={!isFormValid}
          isLoading={isLoading}
          loadingText={t('modals.addTorrent.addingText')}
          className="min-w-[100px]"
        >
          {t('modals.addTorrent.titlePlural')}
        </Button>
      </DialogFooter>
    </>
  )
}
