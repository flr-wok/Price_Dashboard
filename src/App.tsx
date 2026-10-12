import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  Database,
  Download,
  FileSpreadsheet,
  FolderTree,
  Info,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dateTime, fileSize, money, number, percent } from './lib/format'
import type { BillAnalysis, GroupItem, WorkerMessage } from './types'

type View = 'overview' | 'allocation'
type Dimension = 'subscription' | 'product' | 'resourceGroup' | 'region'

const CHART_COLORS = ['#1769e0', '#15a17a', '#7c5ce7', '#ef9b32', '#e55f70', '#60758e', '#33a8d7']

const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: '费用总览', icon: LayoutDashboard },
  { id: 'allocation', label: '分类明细', icon: Layers3 },
]

const dimensions: Array<{ id: Dimension; label: string }> = [
  { id: 'subscription', label: '订阅' },
  { id: 'product', label: '产品' },
  { id: 'resourceGroup', label: '资源组' },
  { id: 'region', label: '地域' },
]

const STORAGE_KEY = 'azure-bill-insight:last-analysis:v2'

const loadStoredAnalysis = (): BillAnalysis | null => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as BillAnalysis : null
  } catch {
    return null
  }
}

const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const name = label || payload[0]?.payload?.name
  return (
    <div className="chart-tooltip">
      <span>{name}</span>
      <strong>{money(Number(payload[0].value))}</strong>
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Cloud size={21} strokeWidth={2.2} /></span>
      <span className="brand-copy">
        <strong>Bill Insight</strong>
        <small>AZURE COST CENTER</small>
      </span>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  meta,
  tone = 'blue',
  badge,
}: {
  icon: LucideIcon
  label: string
  value: string
  meta: ReactNode
  tone?: 'blue' | 'green' | 'violet' | 'amber'
  badge?: string
}) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon ${tone}`}><Icon size={20} /></div>
      <div className="kpi-label-row">
        <span>{label}</span>
        {badge && <span className={`mini-badge ${tone}`}>{badge}</span>}
      </div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-meta">{meta}</div>
    </article>
  )
}

function CardHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="card-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}

function Overview({ data }: { data: BillAnalysis }) {
  return (
    <div className="view-stack">
      <section className="kpi-grid">
        <KpiCard
          icon={CircleDollarSign}
          label="账单费用"
          value={money(data.totalCost, true)}
          meta={<><span className="meta-positive"><ArrowUpRight size={14} /> 本期总额</span><span> · USD</span></>}
          tone="blue"
        />
        <KpiCard
          icon={Database}
          label="账单明细"
          value={number(data.rowCount)}
          meta={<span>已汇总全部消费记录</span>}
          tone="violet"
        />
        <KpiCard
          icon={Layers3}
          label="订阅数量"
          value={number(data.subscriptionCount)}
          meta={<span>来自 subscriptionName 字段</span>}
          tone="green"
        />
        <KpiCard
          icon={FolderTree}
          label="资源组数量"
          value={number(data.resourceGroupCount)}
          meta={<span>来自 resourceGroupName 字段</span>}
          tone="amber"
        />
      </section>

      <section className="chart-grid-primary">
        <article className="panel trend-panel">
          <CardHeader
            eyebrow="SPEND TREND"
            title="每日费用趋势"
            action={<span className="soft-pill"><span className="legend-dot blue" /> Cost in USD</span>}
          />
          <div className="trend-summary">
            <span>账单周期累计</span>
            <strong>{money(data.totalCost)}</strong>
          </div>
          <div className="chart-area trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trendData} margin={{ top: 16, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1769e0" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#1769e0" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8290a3', fontSize: 11 }} minTickGap={22} />
                <YAxis tickFormatter={(v) => money(v, true).replace('$', '')} tickLine={false} axisLine={false} tick={{ fill: '#8290a3', fontSize: 11 }} width={48} />
                <Tooltip content={<MoneyTooltip />} cursor={{ stroke: '#1769e0', strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="value" stroke="#1769e0" strokeWidth={2.6} fill="url(#costGradient)" activeDot={{ r: 5, fill: '#1769e0', stroke: '#fff', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel distribution-panel">
          <CardHeader eyebrow="COST MIX" title="业务费用构成" action={<button className="icon-button" aria-label="费用构成说明"><Info size={17} /></button>} />
          <div className="donut-wrap">
            <div className="donut-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.categoryData} dataKey="value" nameKey="name" innerRadius={66} outerRadius={91} paddingAngle={2} stroke="none">
                    {data.categoryData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<MoneyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><strong>{data.categoryData.length}</strong><span>类业务</span></div>
            </div>
            <div className="legend-list">
              {data.categoryData.slice(0, 6).map((item, index) => (
                <div className="legend-row" key={item.name}>
                  <span className="legend-name"><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name}</span>
                  <span><strong>{percent(item.percent)}</strong><small>{money(item.value, true)}</small></span>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="panel all-subscriptions-panel">
        <CardHeader
          eyebrow="ALL SUBSCRIPTIONS"
          title="全部订阅费用"
          action={<span className="soft-pill">共 {data.subscriptionData.length} 个订阅</span>}
        />
        <div className="overview-table-scroll">
          <table className="overview-subscription-table">
            <thead>
              <tr><th>序号</th><th>订阅名称</th><th>费用（USD）</th><th>占总费用</th><th>费用权重</th></tr>
            </thead>
            <tbody>
              {data.subscriptionData.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>{String(index + 1).padStart(2, '0')}</td>
                  <td><strong>{item.name}</strong></td>
                  <td className={item.value < 0 ? 'negative' : ''}>{money(item.value)}</td>
                  <td>{percent(item.percent)}</td>
                  <td><div className="table-progress"><span style={{ width: `${Math.min(100, Math.abs(item.percent) * 100)}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="complete-list-note"><CheckCircle2 size={14} /> 已显示账单中全部 {data.subscriptionData.length} 个唯一订阅</div>
      </section>
    </div>
  )
}

function Allocation({ data }: { data: BillAnalysis }) {
  const [dimension, setDimension] = useState<Dimension>('subscription')
  const [query, setQuery] = useState('')

  const section = useMemo(() => {
    const source: Record<Dimension, typeof data.subscriptionData> = {
      subscription: data.subscriptionData,
      product: data.productData,
      resourceGroup: data.resourceGroupData,
      region: data.regionData,
    }
    const fieldNames: Record<Dimension, string> = {
      subscription: 'subscriptionName',
      product: 'meterCategory（产品大类）',
      resourceGroup: 'resourceGroupName',
      region: 'resourceLocation / location / meterRegion',
    }
    const normalizedQuery = query.trim().toLowerCase()
    const definition = dimensions.find((item) => item.id === dimension)!
    return {
      ...definition,
      field: fieldNames[dimension],
      total: source[dimension].length,
      rows: source[dimension].filter((row) => row.name.toLowerCase().includes(normalizedQuery)),
    }
  }, [data, dimension, query])

  const dimensionCounts: Record<Dimension, number> = {
    subscription: data.subscriptionData.length,
    product: data.productData.length,
    resourceGroup: data.resourceGroupData.length,
    region: data.regionData.length,
  }

  return (
    <div className="view-stack">
      <section className="split-summary-grid">
        <article className="allocation-hero panel">
          <div className="allocation-hero-icon"><Layers3 size={24} /></div>
          <div>
            <span className="eyebrow">DETAIL DIMENSIONS</span>
            <h2>账单维度完整汇总</h2>
            <p>订阅、产品大类、资源组和地域通过上方选项切换查看；当前选项内完整显示全部唯一值，不分页、不截断。</p>
          </div>
          <div className="coverage-score"><strong>{number(data.rowCount)}</strong><span>明细行已汇总</span></div>
        </article>
        <article className="panel compact-stat"><span>最大订阅</span><strong>{data.subscriptionData[0]?.name ?? '-'}</strong><small>{money(data.subscriptionData[0]?.value ?? 0)} · {percent(data.subscriptionData[0]?.percent ?? 0)}</small></article>
        <article className="panel compact-stat"><span>最大产品大类</span><strong>{data.productData[0]?.name ?? '-'}</strong><small>{money(data.productData[0]?.value ?? 0)} · {percent(data.productData[0]?.percent ?? 0)}</small></article>
      </section>

      <section className="panel table-panel dimension-section">
        <div className="table-toolbar dimension-switch-toolbar">
          <div className="dimension-tabs">
            {dimensions.map((item) => (
              <button className={dimension === item.id ? 'active' : ''} onClick={() => { setDimension(item.id); setQuery('') }} key={item.id}>
                {item.label}<span>{dimensionCounts[item.id]}</span>
              </button>
            ))}
          </div>
          <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`搜索${section.label}名称`} /></label>
        </div>
        <div className="dimension-section-header">
          <div><span className="dimension-label">{section.label}</span><h2>{section.label === '产品' ? '产品大类' : section.label}完整清单</h2><p>数据来源：{section.field}</p></div>
          <span className="dimension-total">{query ? `${section.rows.length} / ` : ''}{section.total} 个唯一值</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>名称</th><th>金额（USD）</th><th>占总费用</th><th>费用权重</th></tr></thead>
            <tbody>
              {section.rows.map((item, index) => (
                <tr key={`${section.id}-${item.name}-${index}`}>
                  <td><span className="row-rank">{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong></td>
                  <td className={item.value < 0 ? 'negative' : ''}>{money(item.value)}</td>
                  <td>{percent(item.percent)}</td>
                  <td><div className="table-progress"><span style={{ width: `${Math.min(100, Math.abs(item.percent) * 100)}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span><CheckCircle2 size={14} /> 已完整显示 {section.rows.length} 个唯一值</span></div>
      </section>
    </div>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="empty-state">
      <div className="empty-visual">
        <span className="empty-file"><FileSpreadsheet size={38} /></span>
        <i className="empty-orbit one" /><i className="empty-orbit two" />
      </div>
      <span className="eyebrow">AZURE COST DETAILS</span>
      <h1>导入 Azure 原始账单</h1>
      <p>直接分析包含 costInUsd、subscriptionName、meterCategory、resourceGroupName 和地域字段的账单明细，无需额外工作表。</p>
      <button className="button primary empty-upload-button" onClick={onUpload}><Upload size={17} />选择 Excel 账单<ChevronRight size={16} /></button>
      <div className="empty-features">
        <span><CheckCircle2 size={15} /> 全部订阅</span><span><CheckCircle2 size={15} /> 全部产品大类</span><span><CheckCircle2 size={15} /> 全部资源组</span><span><CheckCircle2 size={15} /> 全部地域</span>
      </div>
      <small><LockKeyhole size={14} /> 文件只在当前浏览器中解析，不会上传服务器</small>
    </section>
  )
}

const paginatePdfRows = <T,>(rows: T[], maxRows = 22): T[][] => {
  if (!rows.length) return [[]]
  const pageCount = Math.ceil(rows.length / maxRows)
  const rowsPerPage = Math.ceil(rows.length / pageCount)
  return Array.from({ length: pageCount }, (_, index) => rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage))
}

function PdfHeader({ data }: { data: BillAnalysis }) {
  return (
    <div className="pdf-heading">
      <Brand />
      <div><strong>{data.periodLabel} Azure 账单分析报告</strong><span>生成于 {new Date().toLocaleString('zh-CN')}</span></div>
    </div>
  )
}

function PdfFooter({ data, page, total }: { data: BillAnalysis; page: number; total: number }) {
  return (
    <div className="pdf-footer">
      <span>Bill Insight · Azure Cost Center</span>
      <span>第 {page} / {total} 页</span>
      <span>数据来源：{data.fileName}</span>
    </div>
  )
}

function PdfRankList({ title, rows }: { title: string; rows: GroupItem[] }) {
  return (
    <div className="pdf-rank-card">
      <h3>{title}</h3>
      <div className="pdf-rank-list">
        {rows.map((item, index) => (
          <div key={`${title}-${item.name}`}>
            <span className="pdf-rank-index">{String(index + 1).padStart(2, '0')}</span>
            <strong title={item.name}>{item.name}</strong>
            <span>{money(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PdfReport({ data }: { data: BillAnalysis }) {
  const sections: Array<{ id: Dimension; title: string; source: string; rows: GroupItem[] }> = [
    { id: 'subscription', title: '订阅费用明细', source: 'subscriptionName', rows: data.subscriptionData },
    { id: 'product', title: '产品大类费用明细', source: 'meterCategory', rows: data.productData },
    { id: 'resourceGroup', title: '资源组费用明细', source: 'resourceGroupName', rows: data.resourceGroupData },
    { id: 'region', title: '地域费用明细', source: 'resourceLocation / location / meterRegion', rows: data.regionData },
  ]
  const detailPages = sections.flatMap((section) => {
    const pages = paginatePdfRows(section.rows)
    return pages.map((rows, index) => ({ ...section, rows, sectionPage: index + 1, sectionPages: pages.length }))
  })
  const totalPages = detailPages.length + 1
  const maxDailyCost = Math.max(1, ...data.trendData.map((item) => Math.abs(item.value)))

  return (
    <div className="pdf-report">
      <section className="pdf-sheet pdf-summary-sheet">
        <PdfHeader data={data} />
        <div className="pdf-kpis">
          <div><span>账单费用（USD）</span><strong>{money(data.totalCost)}</strong></div>
          <div><span>账单明细</span><strong>{number(data.rowCount)}</strong></div>
          <div><span>订阅数量</span><strong>{number(data.subscriptionData.length)}</strong></div>
          <div><span>资源组数量</span><strong>{number(data.resourceGroupData.length)}</strong></div>
        </div>

        <div className="pdf-section-title"><div><span>OVERVIEW</span><h2>账单费用概览</h2></div><p>币种：{data.currency}</p></div>
        <div className="pdf-bars">
          {data.categoryData.map((item, index) => (
            <div key={item.name}>
              <p><span><i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />{item.name}</span><strong>{money(item.value)} · {percent(item.percent)}</strong></p>
              <em><i style={{ width: `${Math.max(1, Math.abs(item.percent) * 100)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} /></em>
            </div>
          ))}
        </div>

        <div className="pdf-dimension-summary">
          <div><span>订阅</span><strong>{data.subscriptionData.length}</strong><small>个唯一值</small></div>
          <div><span>产品大类</span><strong>{data.productData.length}</strong><small>个唯一值</small></div>
          <div><span>资源组</span><strong>{data.resourceGroupData.length}</strong><small>个唯一值</small></div>
          <div><span>地域</span><strong>{data.regionData.length}</strong><small>个唯一值</small></div>
        </div>

        <div className="pdf-rank-grid">
          <PdfRankList title="费用最高的订阅" rows={data.subscriptionData.slice(0, 8)} />
          <PdfRankList title="费用最高的产品大类" rows={data.productData.slice(0, 8)} />
        </div>
        <div className="pdf-trend-card">
          <div><h3>每日费用趋势</h3><span>账单周期累计 {money(data.totalCost)}</span></div>
          <div className="pdf-trend-bars">
            {data.trendData.map((item, index) => (
              <div key={item.date}>
                <i style={{ height: `${Math.max(3, (Math.abs(item.value) / maxDailyCost) * 100)}%` }} />
                <small>{index % 3 === 0 || index === data.trendData.length - 1 ? item.label : ''}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="pdf-coverage-note"><CheckCircle2 size={17} /> 后续页面按订阅、产品大类、资源组和地域分别列出账单中的全部唯一值。</div>
        <PdfFooter data={data} page={1} total={totalPages} />
      </section>

      {detailPages.map((section, pageIndex) => {
        const startIndex = detailPages.slice(0, pageIndex).filter((item) => item.id === section.id).reduce((sum, item) => sum + item.rows.length, 0)
        return (
          <section className="pdf-sheet pdf-detail-sheet" key={`${section.id}-${section.sectionPage}`}>
            <PdfHeader data={data} />
            <div className="pdf-section-title pdf-detail-title">
              <div><span>{section.id.toUpperCase()}</span><h2>{section.title}</h2><small>数据来源：{section.source}</small></div>
              <p>本分类共 {sections.find((item) => item.id === section.id)?.rows.length ?? 0} 个唯一值<br />分类内第 {section.sectionPage} / {section.sectionPages} 页</p>
            </div>
            <table className="pdf-data-table">
              <colgroup><col className="pdf-col-rank" /><col className="pdf-col-name" /><col className="pdf-col-cost" /><col className="pdf-col-percent" /></colgroup>
              <thead><tr><th>序号</th><th>名称</th><th>费用（USD）</th><th>占总费用</th></tr></thead>
              <tbody>
                {section.rows.map((item, index) => (
                  <tr key={`${section.id}-${item.name}-${index}`}>
                    <td>{String(startIndex + index + 1).padStart(2, '0')}</td>
                    <td>{item.name}</td>
                    <td className={item.value < 0 ? 'negative' : ''}>{money(item.value)}</td>
                    <td>{percent(item.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pdf-table-note">本页 {section.rows.length} 条 · 表格按完整行分页，无内容截断</div>
            <PdfFooter data={data} page={pageIndex + 2} total={totalPages} />
          </section>
        )
      })}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('overview')
  const [data, setData] = useState<BillAnalysis | null>(loadStoredAnalysis)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progressValue, setProgressValue] = useState(0)
  const [stage, setStage] = useState('准备读取文件')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [showPdfReport, setShowPdfReport] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  const parseFile = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError('请选择 .xlsx 或 .xls 格式的 Azure 账单文件。')
      return
    }
    if (file.size > 250 * 1024 * 1024) {
      setError('文件超过 250 MB，请先精简工作簿后再导入。')
      return
    }

    setError('')
    setUploading(true)
    setProgressValue(1)
    setStage('正在载入本地文件')
    try {
      const buffer = await file.arrayBuffer()
      const worker = new Worker(new URL('./workers/analyze.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data
        if (message.type === 'progress') {
          setProgressValue(message.progress)
          setStage(message.stage)
        } else if (message.type === 'complete') {
          setProgressValue(100)
          setStage('分析完成')
          setData(message.result)
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message.result))
          } catch {
            // The report still works for this session if browser storage is unavailable.
          }
          setView('overview')
          window.setTimeout(() => setUploading(false), 450)
          worker.terminate()
        } else {
          setUploading(false)
          setError(message.error)
          worker.terminate()
        }
      }
      worker.onerror = () => {
        setUploading(false)
        setError('解析进程异常中断，请确认文件未损坏后重试。')
        worker.terminate()
      }
      worker.postMessage({ fileName: file.name, fileSize: file.size, buffer }, [buffer])
    } catch {
      setUploading(false)
      setError('无法读取该文件，请确认文件未被加密或损坏。')
    }
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void parseFile(file)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void parseFile(file)
  }

  const exportPdf = async () => {
    if (!data) {
      fileInput.current?.click()
      return
    }
    setExporting(true)
    setShowPdfReport(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      await document.fonts.ready
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      if (!pdfRef.current) throw new Error('报告视图未就绪')
      const sheets = Array.from(pdfRef.current.querySelectorAll<HTMLElement>('.pdf-sheet'))
      if (!sheets.length) throw new Error('报告分页未就绪')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      const pageWidth = 210
      const pageHeight = 297
      pdf.setProperties({ title: `${data.periodLabel} Azure 账单分析报告`, subject: 'Azure Cost Analysis', creator: 'Bill Insight' })
      for (let index = 0; index < sheets.length; index += 1) {
        const canvas = await html2canvas(sheets[index], {
          scale: 1.35,
          width: 1120,
          height: 1584,
          windowWidth: 1120,
          windowHeight: 1584,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        })
        if (index > 0) pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')
      }
      pdf.save(`${data.periodLabel}-Azure账单分析.pdf`)
    } catch {
      setError('PDF 生成失败，请稍后重试或使用浏览器打印功能。')
    } finally {
      setShowPdfReport(false)
      setExporting(false)
    }
  }

  return (
    <div className="app-shell" onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
      <header className="topbar">
        <Brand />
        <nav className="main-nav" aria-label="主导航">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} disabled={!data} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={16} />{label}</button>)}
        </nav>
        <div className="top-actions">
          <button className="button ghost" onClick={() => fileInput.current?.click()}><Upload size={16} />导入账单</button>
          <button className="button primary" disabled={!data || exporting} onClick={() => void exportPdf()}>{exporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}{exporting ? '正在生成' : '导出 PDF'}</button>
        </div>
      </header>

      <main className="main-content">
        {data ? (
          <>
            <section className="page-heading">
              <div>
                <div className="heading-kicker"><span>{data.periodLabel}</span><i /><span className="verified-text"><CheckCircle2 size={14} /> 解析完成</span></div>
                <h1>{view === 'overview' ? 'Azure 账单分析' : '账单分类明细'}</h1>
                <p>{view === 'overview' ? '直接汇总 Azure 账单明细，掌握费用趋势、业务构成和全部订阅支出。' : '通过切换查看订阅、产品大类、资源组和地域；选中维度内不省略任何唯一值。'}</p>
              </div>
              <div className="file-chip">
                <span className="file-icon"><FileSpreadsheet size={19} /></span>
                <div><strong>{data.fileName}</strong><small>{fileSize(data.fileSize)} · {dateTime(data.generatedAt)} 更新</small></div>
                <button onClick={() => fileInput.current?.click()} aria-label="替换账单"><RefreshCw size={15} /></button>
              </div>
            </section>

            <div className="report-content">
              {view === 'overview' && <Overview data={data} />}
              {view === 'allocation' && <Allocation data={data} />}
            </div>
          </>
        ) : <EmptyState onUpload={() => fileInput.current?.click()} />}
      </main>

      <footer className="site-footer"><span><ShieldCheck size={14} /> 本地安全解析</span><span>Bill Insight · Azure Cost Center</span><span>金额单位：USD</span></footer>

      <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={handleFile} hidden />

      {isDragging && !uploading && <div className="drop-overlay"><div><span><Upload size={28} /></span><strong>释放文件，开始分析</strong><p>支持 Azure 导出的 XLSX / XLS 账单</p></div></div>}

      {uploading && (
        <div className="process-overlay">
          <div className="process-card">
            <div className="process-orbit"><FileSpreadsheet size={26} /><i /><i /></div>
            <span className="eyebrow">LOCAL ANALYSIS</span>
            <h2>正在解析 Azure 账单</h2>
            <p>{stage}</p>
            <div className="process-progress"><span style={{ width: `${progressValue}%` }} /></div>
            <div className="process-meta"><span>{progressValue}%</span><span><LockKeyhole size={13} /> 数据不会离开此设备</span></div>
          </div>
        </div>
      )}

      {error && <div className="toast error-toast"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}

      {exporting && <div className="export-toast"><RefreshCw size={16} className="spin" /> 正在排版并生成 PDF…</div>}
      {showPdfReport && data && <div className="pdf-capture" ref={pdfRef}><PdfReport data={data} /></div>}
    </div>
  )
}
