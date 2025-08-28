import { clsxm } from '~/lib/cn'

interface LoadingCircleProps {
  size: 'small' | 'medium' | 'large'
}

const sizeMap = {
  small: 'text-md',
  medium: 'text-xl',
  large: 'text-3xl',
}
export const LoadingCircle: Component<LoadingCircleProps> = ({
  className,
  size,
}) => (
  <div className={clsxm(sizeMap[size], className)}>
    <i className="i-lucide-loader-2 animate-spin" />
  </div>
)
