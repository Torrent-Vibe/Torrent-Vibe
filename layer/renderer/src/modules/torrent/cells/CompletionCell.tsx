import { DateTimeCell } from './DateTimeCell'

interface CompletionCellProps {
  rowIndex: number
}

export const CompletionCell = ({ rowIndex }: CompletionCellProps) => {
  return (
    <DateTimeCell field="completion_on" format="relative" rowIndex={rowIndex} />
  )
}
