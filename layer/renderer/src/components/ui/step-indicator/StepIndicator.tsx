import { cx } from '~/lib/cn'

interface Step {
  id: string
  title: string
  description?: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export const StepIndicator = ({
  steps,
  currentStep,
  className,
}: StepIndicatorProps) => {
  return (
    <div
      className={cx('flex items-center justify-center w-full px-4', className)}
    >
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cx(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                  {
                    'bg-accent border-accent text-background scale-110':
                      isActive,
                    'bg-accent/10 border-accent text-accent': isCompleted,
                    'bg-background border-border text-text-secondary':
                      !isActive && !isCompleted,
                  },
                )}
              >
                {isCompleted ? (
                  <i className="i-mingcute-check-line text-base" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <div className="mt-3 text-center min-w-0">
                <p
                  className={cx(
                    'text-sm font-medium transition-colors duration-300 whitespace-nowrap',
                    {
                      'text-accent': isActive,
                      'text-text': isCompleted,
                      'text-text-secondary': !isActive && !isCompleted,
                    },
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-text-secondary mt-1 max-w-[100px] truncate">
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector Line */}
            {!isLast && (
              <div className="flex-1 h-px mx-6 mt-[-32px] min-w-[60px]">
                <div
                  className={cx('h-full transition-all duration-300', {
                    'bg-accent': isCompleted,
                    'bg-border': !isCompleted,
                  })}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
