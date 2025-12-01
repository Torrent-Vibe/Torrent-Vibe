import { m } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { StepIndicator } from '~/components/ui/step-indicator/StepIndicator'
import { Spring } from '~/lib/spring'

import { InputSourceSection } from '../components/InputSourceSection'
import { SettingsSection } from '../components/SettingsSection'
import type { AddTorrentModalSharedProps } from '../shared/types'

export const AddTorrentModalMobile = ({
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
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      id: 'input',
      title: t('addTorrent.input'),
      description: t('addTorrent.inputDescription'),
    },
    {
      id: 'settings',
      title: t('addTorrent.settingsTab'),
      description: t('addTorrent.settingsDescription'),
    },
  ]

  // Check if step 1 (input) is valid
  const isStep1Valid =
    (formData.magnetLinks.trim() !== '' &&
      formData.magnetLinks.includes('magnet:')) ||
    formData.files.length > 0

  // Step navigation functions
  const goToNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Render step content
  const renderStepContent = () => {
    if (currentStep === 0) {
      return (
        <m.div
          key="step-0"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={Spring.presets.smooth}
          className="flex flex-col gap-5 min-w-0"
        >
          <InputSourceSection formData={formData} handlers={handlers} />
        </m.div>
      )
    }

    if (currentStep === 1) {
      return (
        <m.div
          key="step-1"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={Spring.presets.smooth}
          className="flex-1 relative"
        >
          <ScrollArea
            rootClassName="flex-1 h-[50vh] -mr-6"
            flex
            viewportClassName="pr-6"
          >
            <SettingsSection
              formData={formData}
              handlers={handlers}
              categories={categories}
              showScrollArea={false}
            />
          </ScrollArea>
        </m.div>
      )
    }

    return null
  }

  // Render footer buttons
  const renderFooterButtons = () => {
    if (currentStep === 0) {
      return (
        <>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-full inline-block"
              disabled={isLoading}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant="primary"
            onClick={goToNextStep}
            disabled={!isStep1Valid}
            className="min-w-[100px]"
          >
            Next
            <i className="i-mingcute-arrow-right-line ml-1" />
          </Button>
        </>
      )
    }

    if (currentStep === 1) {
      return (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevStep}
            disabled={isLoading}
          >
            <i className="i-mingcute-arrow-left-line mr-1" />
            Back
          </Button>
          <Button
            size="sm"
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={!isFormValid}
            isLoading={isLoading}
            loadingText="Adding..."
            className="min-w-[100px]"
          >
            Add Torrents
          </Button>
        </>
      )
    }

    return null
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <i className="i-mingcute-add-line text-white text-sm" />
          </div>
          Add Torrents
        </DialogTitle>
      </DialogHeader>

      <DialogClose />

      {/* Step Indicator */}
      <div className="px-6 pb-4 -mx-4">
        <StepIndicator steps={steps} currentStep={currentStep} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="min-w-0 pt-2 flex-1 flex flex-col min-h-0"
      >
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={Spring.presets.smooth}
          className="min-w-0 flex-1 flex flex-col min-h-0 relative"
        >
          {renderStepContent()}
        </m.div>
      </form>

      <DialogFooter>{renderFooterButtons()}</DialogFooter>
    </>
  )
}
