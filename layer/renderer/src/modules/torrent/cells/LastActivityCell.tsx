import { DateTimeCell } from './DateTimeCell'

interface LastActivityCellProps {
  rowIndex: number
}

export const LastActivityCell = ({ rowIndex }: LastActivityCellProps) => {
  return (
    <DateTimeCell field="last_activity" format="relative" rowIndex={rowIndex} />
  )
}
