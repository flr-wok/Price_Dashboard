export type GroupItem = {
  name: string
  value: number
  percent: number
}

export type TrendItem = {
  date: string
  label: string
  value: number
}

export type BillAnalysis = {
  source: 'demo' | 'file'
  fileName: string
  fileSize: number
  generatedAt: string
  periodLabel: string
  currency: string
  totalCost: number
  rowCount: number
  subscriptionCount: number
  resourceGroupCount: number
  categoryData: GroupItem[]
  subscriptionData: GroupItem[]
  productData: GroupItem[]
  regionData: GroupItem[]
  resourceGroupData: GroupItem[]
  trendData: TrendItem[]
  detailSheetName: string
}

export type WorkerMessage =
  | { type: 'progress'; progress: number; stage: string }
  | { type: 'complete'; result: BillAnalysis }
  | { type: 'error'; error: string }
