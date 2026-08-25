import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button/Button'
import { FloatingPanel } from '~/components/ui/floating-panel/FloatingPanel'

import { AgentChatActions } from './actions'
import { AgentChatPanel } from './AgentChatPanel'
import { AgentHistory } from './AgentHistory'
import { useAgentChatStore } from './store'

const actions = AgentChatActions.shared

export const AgentPanel = () => {
  const { t } = useTranslation()
  const historyOpen = useAgentChatStore((state) => state.historyOpen)
  const isRunning = useAgentChatStore((state) => state.isRunning)
  const panelHeight = useAgentChatStore((state) => state.panelHeight)
  const panelWidth = useAgentChatStore((state) => state.panelWidth)

  return (
    <FloatingPanel
      contentClassName="relative overflow-hidden"
      height={panelHeight}
      icon={<i className="i-mingcute-brain-line text-accent" />}
      minHeight={360}
      minWidth={360}
      title={t('agent.workspace.agent')}
      width={panelWidth}
      zIndex={70}
      actions={
        <>
          {import.meta.env.DEV && (
            <Button
              aria-label={t('agent.demo.title')}
              className="!p-2"
              title={t('agent.demo.title')}
              variant="ghost"
              onClick={() => void actions.loadDemo()}
            >
              <i className="i-mingcute-flask-line text-lg" />
            </Button>
          )}
          <Button
            aria-label={t('agent.history.title')}
            className="!p-2"
            disabled={isRunning}
            title={t('agent.history.title')}
            variant={historyOpen ? 'secondary' : 'ghost'}
            onClick={() =>
              historyOpen ? actions.closeHistory() : void actions.openHistory()
            }
          >
            <i className="i-mingcute-history-line text-lg" />
          </Button>
          <Button
            aria-label={t('agent.newChat')}
            className="!p-2"
            title={t('agent.newChat')}
            variant="ghost"
            onClick={() => actions.reset()}
          >
            <i className="i-mingcute-add-line text-lg" />
          </Button>
          <Button
            aria-label={t('buttons.close')}
            className="!p-2"
            title={t('buttons.close')}
            variant="ghost"
            onClick={() => actions.closePanel()}
          >
            <i className="i-mingcute-close-line text-lg" />
          </Button>
        </>
      }
      onHeightChange={actions.setPanelHeight}
      onWidthChange={actions.setPanelWidth}
    >
      <AgentChatPanel />
      {historyOpen && <AgentHistory />}
    </FloatingPanel>
  )
}
