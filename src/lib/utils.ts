export function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export const DEPARTMENTS = [
  'Quality',
  'Safety',
  'Logistics',
  'Production',
  'Management'
] as const

export const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 border-green-300', dot: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300 animate-pulse', dot: 'bg-red-600' },
] as const

export const STATUSES = [
  { value: 'open', label: 'Open', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' },
  { value: 'started', label: 'Started', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  { value: 'overdue', label: 'OVERDUE', color: 'bg-red-600 text-white', dot: 'bg-red-600' },
] as const

export type Department = typeof DEPARTMENTS[number]
export type Priority = typeof PRIORITIES[number]['value']
export type JobStatus = typeof STATUSES[number]['value']

export function getPriorityConfig(priority: string) {
  return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1]
}

export function getStatusConfig(status: string) {
  return STATUSES.find(s => s.value === status) || STATUSES[0]
}

export function formatDate(date: string | Date | any) {
  if (!date) return '-'
  // Firestore Timestamp support
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDateShort(date: any) {
  if (!date) return '-'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
}
