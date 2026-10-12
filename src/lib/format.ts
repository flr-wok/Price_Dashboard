export const money = (value: number, compact = false) => {
  if (!Number.isFinite(value)) return '$0.00'
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (compact && Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const number = (value: number) => new Intl.NumberFormat('zh-CN').format(value)

export const percent = (value: number) => `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`

export const fileSize = (bytes: number) => {
  if (!bytes) return '示例数据'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
