import { DateTimeCell } from './DateTimeCell'

interface AddedOnCellProps {
  rowIndex: number
}

export const AddedOnCell = ({ rowIndex }: AddedOnCellProps) => {
  return <DateTimeCell field="added_on" format="relative" rowIndex={rowIndex} />
}
