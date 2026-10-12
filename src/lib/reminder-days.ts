export function isDueSoonDay(daysUntilDue: number, selectedDays: readonly number[] = [3, 2]) {
  return Number.isInteger(daysUntilDue) && selectedDays.includes(daysUntilDue);
}
