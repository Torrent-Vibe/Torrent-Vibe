import { m } from 'motion/react'
import { useEffect, useState } from 'react'

import type { ModalComponentProps } from '~/components/ui/modal/types'
import { Spring } from '~/lib/spring'

import { useServerConfigForm } from '../hooks/useServerConfigForm'
import type { ServerFormData } from './ServerConfigForm'
import { ServerConfigForm } from './ServerConfigForm'

interface ServerConfigModalProps extends ModalComponentProps {
  mode: 'add' | 'edit'
  serverId?: string
}

const ServerConfigModal = ({
  mode,
  serverId,
  dismiss,
}: ServerConfigModalProps) => {
  const [initialData, setInitialData] = useState<
    Partial<ServerFormData> | undefined
  >()
  const [isInitializing, setIsInitializing] = useState(mode === 'edit')

  const {
    isSubmitting,
    testResult,
    getInitialData,
    handleSubmit,
    handleTest,
    resetForm,
  } = useServerConfigForm({
    mode,
    serverId,
    onSuccess: () => {
      dismiss()
      resetForm()
    },
    onError: (error) => {
      console.error(`Failed to ${mode} server:`, error)
    },
  })

  // Load initial data for edit mode
  useEffect(() => {
    if (mode === 'edit' && serverId) {
      setIsInitializing(true)
      getInitialData()
        .then(setInitialData)
        .finally(() => setIsInitializing(false))
    }
  }, [mode, serverId])

  const handleClose = () => {
    resetForm()
    dismiss()
  }

  const title = mode === 'add' ? 'Add Server' : 'Edit Server'

  if (mode === 'edit' && isInitializing) {
    return (
      <m.div
        className="bg-background rounded-lg border border-border p-6 max-w-lg w-full mx-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={Spring.presets.smooth}
      >
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-text-secondary">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading server configuration...
          </div>
        </div>
      </m.div>
    )
  }

  return (
    <m.div
      className="bg-background max-w-2xl w-full"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={Spring.presets.smooth}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
      </div>

      <ServerConfigForm
        mode={mode}
        initialData={initialData}
        onSubmit={handleSubmit}
        onTest={handleTest}
        isLoading={isSubmitting}
        testResult={testResult}
        onCancel={handleClose}
      />
    </m.div>
  )
}

export { ServerConfigModal }
