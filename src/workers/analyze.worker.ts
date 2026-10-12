/// <reference lib="webworker" />
import * as XLSX from 'xlsx'
import type { BillAnalysis, GroupItem, TrendItem } from '../types'

type UploadPayload = { fileName: string; fileSize: number; buffer: ArrayBuffer }
type Row = unknown[]

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

const progress = (value: number, stage: string) =>
  ctx.postMessage({ type: 'progress', progress: value, stage })

const text = (value: unknown) => (value == null ? '' : String(value).trim())
const numeric = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(text(value).replace(/[$,%\s,]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const excelDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  const raw = text(value)
  if (!raw || raw === '-') return null
  const match = raw.match(/^(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})/)
  if (match) {
    const first = Number(match[1])
    const year = first > 31 ? first : Number(match[3])
    const month = first > 31 ? Number(match[2]) : Number(match[1])
    const day = first > 31 ? Number(match[3]) : Number(match[2])
    const date = new Date(year, month - 1, day)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isoDate = (value: unknown) => {
  const date = excelDate(value)
  if (!date) return text(value)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const groupItems = (map: Map<string, number>, total: number): GroupItem[] =>
  [...map.entries()]
    .map(([name, value]) => ({ name, value, percent: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value)

const add = (map: Map<string, number>, key: string, value: number) =>
  map.set(key || '未标记', (map.get(key || '未标记') ?? 0) + value)

const headerIndex = (headers: Row, ...candidates: string[]) => {
  const normalized = headers.map((item) => text(item).toLowerCase())
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate.toLowerCase())
    if (index >= 0) return index
  }
  return -1
}

const cell = (row: Row, index: number) => (index >= 0 ? row[index] : null)

const sheetRows = (sheet: XLSX.WorkSheet): Row[] =>
  XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, raw: true, defval: null, blankrows: false })

const findDetailSheet = (workbook: XLSX.WorkBook) => {
  const preferred = workbook.SheetNames[1]
  const candidates = preferred
    ? [preferred, ...workbook.SheetNames.filter((name) => name !== preferred)]
    : workbook.SheetNames
  for (const name of candidates) {
    const rows = sheetRows(workbook.Sheets[name])
    const headers = rows[0] ?? []
    if (headerIndex(headers, 'costInUsd') >= 0 && headerIndex(headers, 'subscriptionName') >= 0) {
      return { name, rows }
    }
  }
  throw new Error('未找到 Azure 账单明细。请确认工作簿中包含 costInUsd 与 subscriptionName 字段。')
}

const categoryFor = (row: Row, idx: Record<string, number>) => {
  const meterCategory = text(cell(row, idx.meterCategory))
  const meterSubCategory = text(cell(row, idx.meterSubCategory))
  const serviceFamily = text(cell(row, idx.serviceFamily))
  const publisherType = text(cell(row, idx.publisherType))
  const product = text(cell(row, idx.product))
  const haystack = `${meterCategory} ${meterSubCategory} ${product}`.toLowerCase()

  if (haystack.includes('bing') || meterCategory === 'MS Bing Services') return 'Bing Search'
  if (meterCategory.toLowerCase() === 'github') return 'Github Copilot'
  if (meterCategory === 'Foundry Models') {
    if (/fireworks|glm|deepseek|qwen|kimi|doubao/i.test(haystack)) return 'Foundry 国产模型'
    return 'Foundry OpenAI 模型'
  }
  if (publisherType === 'Marketplace' || meterCategory === 'SaaS' || serviceFamily === 'SaaS') {
    return 'Marketplace'
  }
  return 'Infra · 基础云资源'
}

const periodFrom = (dates: string[]) => {
  const first = dates.filter(Boolean).sort()[0]
  if (!first) return '账单周期'
  const [year, month] = first.split('-')
  return `${year}年${Number(month)}月`
}

ctx.onmessage = (event: MessageEvent<UploadPayload>) => {
  const { fileName, fileSize, buffer } = event.data
  try {
    progress(4, '正在读取工作簿结构')
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, dense: true })
    progress(24, `已识别 ${workbook.SheetNames.length} 个工作表`)

    const detail = findDetailSheet(workbook)
    const rows = detail.rows
    const headers = rows[0] ?? []
    progress(38, `正在分析 ${Math.max(0, rows.length - 1).toLocaleString('zh-CN')} 条明细`)

    const idx = {
      cost: headerIndex(headers, 'costInUsd', 'costInBillingCurrency'),
      date: headerIndex(headers, 'date', 'usageDate'),
      subscription: headerIndex(headers, 'subscriptionName'),
      subscriptionId: headerIndex(headers, 'subscriptionId'),
      meterCategory: headerIndex(headers, 'meterCategory'),
      meterSubCategory: headerIndex(headers, 'meterSubCategory'),
      serviceFamily: headerIndex(headers, 'serviceFamily'),
      publisherType: headerIndex(headers, 'publisherType'),
      product: headerIndex(headers, 'product'),
      resourceGroup: headerIndex(headers, 'resourceGroupName'),
      resourceLocation: headerIndex(headers, 'resourceLocation'),
      location: headerIndex(headers, 'location'),
      meterRegion: headerIndex(headers, 'meterRegion'),
    }
    if (idx.cost < 0) throw new Error('账单明细缺少 costInUsd 金额字段。')

    const calculatedCategory = new Map<string, number>()
    const calculatedSubscription = new Map<string, number>()
    const calculatedProduct = new Map<string, number>()
    const regionMap = new Map<string, number>()
    const resourceGroupMap = new Map<string, number>()
    const trendMap = new Map<string, number>()
    let totalCost = 0
    const subscriptions = new Set<string>()
    const resourceGroups = new Set<string>()
    const dates: string[] = []

    const rowCount = Math.max(0, rows.length - 1)
    rows.slice(1).forEach((row, rowIndex) => {
      const cost = numeric(cell(row, idx.cost))
      totalCost += cost

      const subscription = text(cell(row, idx.subscription)) || text(cell(row, idx.subscriptionId)) || '未标记订阅'
      const product = text(cell(row, idx.meterCategory)) || text(cell(row, idx.product)) || '未标记产品大类'
      const region = text(cell(row, idx.resourceLocation)) || text(cell(row, idx.location)) || text(cell(row, idx.meterRegion)) || '未标记地域'
      const resourceGroup = text(cell(row, idx.resourceGroup)) || '未标记资源组'
      const day = isoDate(cell(row, idx.date))

      subscriptions.add(subscription)
      resourceGroups.add(resourceGroup)
      add(calculatedCategory, categoryFor(row, idx), cost)
      add(calculatedSubscription, subscription, cost)
      add(calculatedProduct, product, cost)
      add(regionMap, region, cost)
      add(resourceGroupMap, resourceGroup, cost)
      if (day) {
        add(trendMap, day, cost)
        dates.push(day)
      }

      if (rowIndex > 0 && rowIndex % 6_000 === 0) {
        progress(38 + Math.round((rowIndex / Math.max(1, rowCount)) * 43), `已分析 ${rowIndex.toLocaleString('zh-CN')} 条明细`)
      }
    })

    progress(84, '正在汇总订阅、产品、资源组和地域')
    const categoryData = groupItems(calculatedCategory, totalCost)
    const subscriptionData = groupItems(calculatedSubscription, totalCost)
    const productData = groupItems(calculatedProduct, totalCost)
    const trendData: TrendItem[] = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, label: date.slice(5), value }))

    const result: BillAnalysis = {
      source: 'file',
      fileName,
      fileSize,
      generatedAt: new Date().toISOString(),
      periodLabel: periodFrom(dates),
      currency: 'USD',
      totalCost,
      rowCount,
      subscriptionCount: subscriptions.size,
      resourceGroupCount: resourceGroups.size,
      categoryData,
      subscriptionData,
      productData,
      regionData: groupItems(regionMap, totalCost),
      resourceGroupData: groupItems(resourceGroupMap, totalCost),
      trendData,
      detailSheetName: detail.name,
    }

    progress(96, '正在生成分析结果')
    ctx.postMessage({ type: 'complete', result })
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法解析该账单文件'
    ctx.postMessage({ type: 'error', error: message })
  }
}

export {}
