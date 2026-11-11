import { useState, type KeyboardEvent } from 'react'
import WorkflowEditor from './WorkflowEditor'
import './App.css'

type Page = 'Dashboard' | 'Agents' | 'Workflows' | 'Monitoring' | 'Analytics' | 'Approvals' | 'Logs' | 'Errors' | 'Security' | 'Performance & Costs'

const navigation = [
  { label: 'Dashboard' as Page, icon: '▦' },
  { label: 'Agents' as Page, icon: '✧' },
  { label: 'Workflows' as Page, icon: '⌘' },
  { label: 'Monitoring' as Page, icon: '◉' },
  { label: 'Analytics' as Page, icon: '▥' },
  { label: 'Approvals' as Page, icon: '✓' },
  { label: 'Logs' as Page, icon: '≡' },
  { label: 'Errors' as Page, icon: '!' },
  { label: 'Security' as Page, icon: '◇' },
  { label: 'Performance & Costs' as Page, icon: '↗' },
]

const pageDetails = {
  Agents: {
    subtitle: 'Manage and review the agents in your workspace.',
  },
  Workflows: {
    subtitle: 'Build and monitor the automations powered by your agents.',
  },
} as const

const stats = [
  { label: 'Total Agents', value: '24', change: '+3 this month', icon: '✧', tone: 'violet' },
  { label: 'Active Agents', value: '18', change: '75% of all agents', icon: '◉', tone: 'green' },
  { label: 'Total Executions', value: '12,486', change: '+12.8% this week', icon: '↗', tone: 'blue' },
  { label: 'Success Rate', value: '98.6%', change: '+2.4% this month', icon: '✓', tone: 'amber' },
]

const executions = [
  { name: 'Customer Support Assistant', initials: 'CS', color: 'purple', task: 'Respond to customer inquiry', time: 'Just now', duration: '1.2s', status: 'Completed' },
  { name: 'Data Enrichment Agent', initials: 'DE', color: 'blue', task: 'Enrich company profile', time: '2 min ago', duration: '3.8s', status: 'Completed' },
  { name: 'Lead Qualification', initials: 'LQ', color: 'orange', task: 'Score incoming lead', time: '8 min ago', duration: '2.1s', status: 'Running' },
  { name: 'Content Writer', initials: 'CW', color: 'pink', task: 'Generate weekly newsletter', time: '14 min ago', duration: '—', status: 'Failed' },
  { name: 'Research Assistant', initials: 'RA', color: 'teal', task: 'Summarize market trends', time: '26 min ago', duration: '5.4s', status: 'Completed' },
]

const demoAgents = [
  { name: 'Customer Support Assistant', initials: 'CS', color: 'purple', description: 'Answers product questions and helps customers resolve common issues.', status: 'Active', type: 'Conversational', model: 'GPT-4.1 mini', created: 'October 12, 2026', updated: 'November 11, 2026' },
  { name: 'Lead Qualification', initials: 'LQ', color: 'orange', description: 'Reviews new leads, scores fit, and prepares a concise handoff for sales.', status: 'Active', type: 'Sales automation', model: 'GPT-4.1', created: 'September 28, 2026', updated: 'November 10, 2026' },
  { name: 'Data Enrichment Agent', initials: 'DE', color: 'blue', description: 'Enriches company records with verified firmographic details.', status: 'Active', type: 'Data processing', model: 'Claude 3.5 Haiku', created: 'September 16, 2026', updated: 'November 10, 2026' },
  { name: 'Content Writer', initials: 'CW', color: 'pink', description: 'Creates on-brand first drafts for newsletters and campaign copy.', status: 'Inactive', type: 'Content generation', model: 'GPT-4.1', created: 'August 21, 2026', updated: 'November 8, 2026' },
  { name: 'Research Assistant', initials: 'RA', color: 'teal', description: 'Collects source material and summarizes market research findings.', status: 'Active', type: 'Research', model: 'Gemini 2.5 Flash', created: 'August 4, 2026', updated: 'November 7, 2026' },
  { name: 'Meeting Notes Organizer', initials: 'MN', color: 'violet', description: 'Turns meeting transcripts into decisions, summaries, and action items.', status: 'Inactive', type: 'Productivity', model: 'GPT-4.1 mini', created: 'July 19, 2026', updated: 'November 5, 2026' },
]

const demoWorkflows = [
  { name: 'New Lead Qualification', description: 'Researches incoming leads, scores fit, and routes qualified prospects to sales.', steps: 4, status: 'Active', updated: 'November 11, 2026', initials: 'LQ', color: 'orange' },
  { name: 'Weekly Newsletter Draft', description: 'Collects product updates and prepares a review-ready newsletter draft.', steps: 3, status: 'Active', updated: 'November 10, 2026', initials: 'WN', color: 'purple' },
  { name: 'Customer Feedback Summary', description: 'Groups recent feedback by theme and shares a concise team summary.', steps: 5, status: 'Inactive', updated: 'November 8, 2026', initials: 'CF', color: 'blue' },
  { name: 'Company Data Enrichment', description: 'Adds verified company details to new CRM records automatically.', steps: 3, status: 'Active', updated: 'November 7, 2026', initials: 'DE', color: 'teal' },
  { name: 'Support Escalation', description: 'Detects urgent support requests and prepares an escalation handoff.', steps: 4, status: 'Draft', updated: 'November 5, 2026', initials: 'SE', color: 'pink' },
  { name: 'Meeting Follow-up', description: 'Turns meeting notes into action items and a follow-up email draft.', steps: 2, status: 'Draft', updated: 'November 3, 2026', initials: 'MF', color: 'violet' },
]

type ExecutionStatus = 'Success' | 'Failed' | 'Running'
type DemoExecution = {
  id: string
  workflowName: string
  agentName: string
  status: ExecutionStatus
  duration: string
  dateTime: string
  details: string
}

const demoExecutionHistory: DemoExecution[] = [
  { id: 'EX-1042', workflowName: 'Support Ticket Triage', agentName: 'Customer Support Assistant', status: 'Success', duration: '1.8s', dateTime: 'Nov 11, 2026 · 9:32 AM', details: 'The customer request was categorized and a suggested response was prepared.' },
  { id: 'EX-1041', workflowName: 'New Lead Qualification', agentName: 'Lead Qualification', status: 'Running', duration: 'In progress', dateTime: 'Nov 11, 2026 · 9:28 AM', details: 'The workflow is researching the lead and scoring its fit.' },
  { id: 'EX-1040', workflowName: 'Company Data Enrichment', agentName: 'Data Enrichment Agent', status: 'Success', duration: '3.4s', dateTime: 'Nov 11, 2026 · 9:22 AM', details: 'Company profile fields were enriched with sample firmographic data.' },
  { id: 'EX-1039', workflowName: 'Weekly Newsletter Draft', agentName: 'Content Writer', status: 'Failed', duration: '7.2s', dateTime: 'Nov 11, 2026 · 9:14 AM', details: 'Demo error: the content source returned an empty response. Review the source selection and try again.' },
  { id: 'EX-1038', workflowName: 'Customer Feedback Summary', agentName: 'Research Assistant', status: 'Success', duration: '5.1s', dateTime: 'Nov 11, 2026 · 9:06 AM', details: 'Feedback was grouped into three themes and a summary was generated.' },
  { id: 'EX-1037', workflowName: 'Support Ticket Triage', agentName: 'Customer Support Assistant', status: 'Success', duration: '2.2s', dateTime: 'Nov 10, 2026 · 4:52 PM', details: 'The support ticket was classified and routed to the billing queue.' },
  { id: 'EX-1036', workflowName: 'Meeting Follow-up', agentName: 'Meeting Notes Organizer', status: 'Failed', duration: '4.6s', dateTime: 'Nov 10, 2026 · 4:40 PM', details: 'Demo error: no transcript was attached to this meeting. Add a transcript and retry.' },
  { id: 'EX-1035', workflowName: 'New Lead Qualification', agentName: 'Lead Qualification', status: 'Running', duration: 'In progress', dateTime: 'Nov 10, 2026 · 4:31 PM', details: 'The workflow is processing a sample lead record.' },
]

const analyticsAgents = [
  { name: 'Customer Support Assistant', executions: 328, success: 98.8, color: 'purple' },
  { name: 'Lead Qualification', executions: 286, success: 97.9, color: 'orange' },
  { name: 'Data Enrichment Agent', executions: 254, success: 99.2, color: 'blue' },
  { name: 'Content Writer', executions: 198, success: 96.4, color: 'pink' },
  { name: 'Research Assistant', executions: 174, success: 98.1, color: 'teal' },
]

const durationData = [
  { name: 'Customer Support Assistant', duration: 1.8, color: 'purple' },
  { name: 'Lead Qualification', duration: 2.4, color: 'orange' },
  { name: 'Data Enrichment Agent', duration: 3.1, color: 'blue' },
  { name: 'Research Assistant', duration: 4.7, color: 'teal' },
]

type CostPerformanceAgent = {
  name: string
  executions: number
  successRate: number
  averageSeconds: number
  cost: number
  usageTrend: number[]
  costTrend: number[]
}

const performanceCostAgents: CostPerformanceAgent[] = [
  { name: 'Customer Support Assistant', executions: 3280, successRate: 98.8, averageSeconds: 1.8, cost: 48.22, usageTrend: [390, 420, 400, 450, 430, 470, 720], costTrend: [6.8, 6.4, 5.9, 6.7, 6.5, 7.2, 8.72] },
  { name: 'Lead Qualification', executions: 2860, successRate: 97.9, averageSeconds: 2.4, cost: 51.6, usageTrend: [360, 380, 390, 410, 420, 430, 470], costTrend: [6.8, 7.1, 6.8, 7.5, 7.3, 7.6, 8.5] },
  { name: 'Data Enrichment Agent', executions: 2540, successRate: 99.2, averageSeconds: 3.1, cost: 28.4, usageTrend: [340, 350, 360, 370, 380, 400, 340], costTrend: [3.8, 4, 3.9, 4.1, 4, 4.2, 4.4] },
  { name: 'Content Writer', executions: 1980, successRate: 96.4, averageSeconds: 4.1, cost: 32.1, usageTrend: [280, 270, 260, 280, 290, 300, 300], costTrend: [4.5, 4.4, 4.3, 4.6, 4.6, 4.7, 5] },
  { name: 'Research Assistant', executions: 1826, successRate: 98.1, averageSeconds: 4.7, cost: 24.4, usageTrend: [130, 200, 190, 290, 200, 450, 366], costTrend: [3.5, 3.4, 3.5, 3.6, 3.8, 3.9, 2.7] },
]

const costBreakdownData = [
  { agent: 'Customer Support Assistant', workflow: 'Support Ticket Triage', cost: 24.1, executions: 1640 },
  { agent: 'Customer Support Assistant', workflow: 'Refund Review', cost: 24.12, executions: 1640 },
  { agent: 'Lead Qualification', workflow: 'New Lead Qualification', cost: 38.2, executions: 2160 },
  { agent: 'Lead Qualification', workflow: 'Lead Follow-up Prep', cost: 13.4, executions: 700 },
  { agent: 'Data Enrichment Agent', workflow: 'Company Data Enrichment', cost: 18.4, executions: 1840 },
  { agent: 'Data Enrichment Agent', workflow: 'CRM Quality Check', cost: 10, executions: 700 },
  { agent: 'Content Writer', workflow: 'Weekly Newsletter Draft', cost: 20.8, executions: 1260 },
  { agent: 'Content Writer', workflow: 'Product Launch Copy', cost: 11.3, executions: 720 },
  { agent: 'Research Assistant', workflow: 'Customer Feedback Summary', cost: 24.4, executions: 1826 },
]

const trendDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function TrendLineChart({ values, chartId, color, unit, title }: { values: number[]; chartId: string; color: string; unit: string; title: string }) {
  const maxValue = Math.max(...values, 1)
  const points = values.map((value, index) => ({ x: (index / (values.length - 1)) * 700, y: 165 - (value / maxValue) * 135 }))
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  const areaPath = `${linePath} L700 170 L0 170 Z`
  return (
    <div className="performance-trend-chart" role="img" aria-label={`${title}: demo data ${values.map((value, index) => `${trendDays[index]} ${unit === '$' ? `$${value.toFixed(2)}` : value.toLocaleString()}`).join(', ')}`}>
      <div className="performance-trend-y"><span>{unit === '$' ? `$${maxValue.toFixed(0)}` : maxValue.toLocaleString()}</span><span>{unit === '$' ? `$${(maxValue / 2).toFixed(0)}` : Math.round(maxValue / 2).toLocaleString()}</span><span>0</span></div>
      <svg viewBox="0 0 700 180" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`${chartId}-fill`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".24" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path className="performance-grid-lines" d="M0 30H700 M0 100H700 M0 170H700" />
        <path d={areaPath} fill={`url(#${chartId}-fill)`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="4" fill={color} stroke="#17181e" strokeWidth="3" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="performance-trend-x">{trendDays.map((day) => <span key={day}>{day}</span>)}</div>
    </div>
  )
}

function PerformanceCostsPage() {
  const [selectedAgentName, setSelectedAgentName] = useState('All agents')
  const visibleAgents = selectedAgentName === 'All agents' ? performanceCostAgents : performanceCostAgents.filter((agent) => agent.name === selectedAgentName)
  const totalExecutions = visibleAgents.reduce((sum, agent) => sum + agent.executions, 0)
  const totalCost = visibleAgents.reduce((sum, agent) => sum + agent.cost, 0)
  const overallSuccessRate = visibleAgents.length ? visibleAgents.reduce((sum, agent) => sum + agent.successRate * agent.executions, 0) / totalExecutions : 0
  const averageSeconds = visibleAgents.length ? visibleAgents.reduce((sum, agent) => sum + agent.averageSeconds * agent.executions, 0) / totalExecutions : 0
  const usageTrend = trendDays.map((_, index) => visibleAgents.reduce((sum, agent) => sum + agent.usageTrend[index], 0))
  const costTrend = trendDays.map((_, index) => visibleAgents.reduce((sum, agent) => sum + agent.costTrend[index], 0))
  const visibleAgentNames = new Set(visibleAgents.map((agent) => agent.name))
  const visibleCostRows = costBreakdownData.filter((row) => visibleAgentNames.has(row.agent))
  const metrics = [
    { label: 'Total Executions', value: totalExecutions.toLocaleString(), note: 'Demo executions', tone: 'blue', icon: '↗' },
    { label: 'Overall Success Rate', value: `${overallSuccessRate.toFixed(1)}%`, note: 'Weighted by execution volume', tone: 'green', icon: '✓' },
    { label: 'Average Execution Time', value: `${averageSeconds.toFixed(1)}s`, note: 'Average across selected agents', tone: 'violet', icon: '◷' },
    { label: 'Estimated Total Cost', value: `$${totalCost.toFixed(2)}`, note: 'Estimated USD usage', tone: 'amber', icon: '$' },
  ]

  return (
    <>
      <section className="page-heading performance-page-heading">
        <div><p className="eyebrow">WORKSPACE</p><div className="heading-title-row"><h1>Performance &amp; Costs</h1><span className="demo-badge">Demo Data</span></div><p className="heading-subtitle">Compare agent reliability, execution speed, and estimated usage costs.</p></div>
        <label className="performance-agent-filter"><span>View agent</span><select value={selectedAgentName} onChange={(event) => setSelectedAgentName(event.target.value)} aria-label="Filter performance and costs by agent"><option>All agents</option>{performanceCostAgents.map((agent) => <option key={agent.name}>{agent.name}</option>)}</select></label>
      </section>
      <div className="demo-note"><span className="demo-note-dot" /> All performance metrics and USD cost estimates shown are sample demo data.</div>

      <section className="stats-grid performance-stats" aria-label="Demo performance and cost metrics">
        {metrics.map((metric) => <article className="stat-card" key={metric.label}>
          <div className="stat-topline"><span>{metric.label}</span><span className={`stat-icon ${metric.tone}`} aria-hidden="true">{metric.icon}</span></div><div className="stat-value">{metric.value}</div><div className="stat-change">{metric.note}</div>
        </article>)}
      </section>

      <section className="executions-panel performance-agent-panel">
        <div className="panel-header"><div><h2>Agent Performance <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Execution volume, success, speed, and estimated cost by agent.</p></div></div>
        <div className="table-wrap"><table className="agent-performance-table"><thead><tr><th>AGENT NAME</th><th>TOTAL EXECUTIONS</th><th>SUCCESS RATE</th><th>AVG. EXECUTION TIME</th><th>ESTIMATED COST</th></tr></thead>
          <tbody>{visibleAgents.map((agent) => <tr key={agent.name}><td className="secondary-name"><strong>{agent.name}</strong></td><td className="duration-cell">{agent.executions.toLocaleString()}</td><td><div className="performance-rate"><span>{agent.successRate.toFixed(1)}%</span><i><b style={{ width: `${agent.successRate}%` }} /></i></div></td><td className="duration-cell">{agent.averageSeconds.toFixed(1)}s</td><td className="performance-cost">${agent.cost.toFixed(2)}</td></tr>)}</tbody>
        </table></div>
        <div className="table-footer"><span>Showing <strong>{visibleAgents.length}</strong> of <strong>{performanceCostAgents.length}</strong> demo agents</span><span className="demo-footer-label">Time in seconds · Cost in USD</span></div>
      </section>

      <div className="performance-charts-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><h2>Usage Trends</h2><p>Demo execution volume over the last 7 days</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
          <TrendLineChart values={usageTrend} chartId="usage-trend" color="#a58ae9" unit="runs" title="Usage trends" />
        </section>
        <section className="analytics-panel">
          <div className="analytics-panel-heading"><div><h2>Cost Trends</h2><p>Estimated daily cost in USD</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
          <TrendLineChart values={costTrend} chartId="cost-trend" color="#65c9a0" unit="$" title="Cost trends" />
        </section>
      </div>

      <section className="executions-panel cost-breakdown-panel">
        <div className="panel-header"><div><h2>Cost Breakdown <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Estimated cost by agent and workflow, in USD.</p></div></div>
        <div className="table-wrap"><table className="cost-breakdown-table"><thead><tr><th>AGENT</th><th>WORKFLOW</th><th>EXECUTIONS</th><th>ESTIMATED COST</th><th>COST SHARE</th></tr></thead>
          <tbody>{visibleCostRows.map((row) => <tr key={`${row.agent}-${row.workflow}`}><td>{row.agent}</td><td className="task-cell">{row.workflow}</td><td className="duration-cell">{row.executions.toLocaleString()}</td><td className="performance-cost">${row.cost.toFixed(2)}</td><td><div className="cost-share"><i><b style={{ width: `${(row.cost / Math.max(...visibleCostRows.map((item) => item.cost))) * 100}%` }} /></i><span>{((row.cost / totalCost) * 100).toFixed(1)}%</span></div></td></tr>)}</tbody>
        </table></div>
        <div className="table-footer"><span>Estimated total <strong>${totalCost.toFixed(2)} USD</strong></span><span className="demo-footer-label">Demo data</span></div>
      </section>
    </>
  )
}

function AnalyticsPage() {
  const metricCards = [
    { label: 'Total Executions', value: '12,486', note: '+12.8% over previous period', icon: '↗', tone: 'blue' },
    { label: 'Overall Success Rate', value: '98.6%', note: '+1.4% over previous period', icon: '✓', tone: 'green' },
    { label: 'Average Execution Time', value: '2.4s', note: '0.3s faster than last period', icon: '◷', tone: 'violet' },
    { label: 'Estimated Total Cost', value: '$184.72', note: 'Estimated usage cost', icon: '$', tone: 'amber' },
  ]

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <div className="heading-title-row"><h1>Analytics</h1><span className="demo-badge">Demo Data</span></div>
          <p className="heading-subtitle">Understand execution volume, agent reliability, and usage over time.</p>
        </div>
      </section>
      <div className="demo-note"><span className="demo-note-dot" /> All analytics, performance, and cost figures shown are sample demo data.</div>

      <section className="stats-grid analytics-stats" aria-label="Demo analytics statistics">
        {metricCards.map((metric) => (
          <article className="stat-card" key={metric.label}>
            <div className="stat-topline"><span>{metric.label}</span><span className={`stat-icon ${metric.tone}`} aria-hidden="true">{metric.icon}</span></div>
            <div className="stat-value">{metric.value}</div>
            <div className="stat-change"><span className="change-arrow">↗</span>{metric.note}</div>
          </article>
        ))}
      </section>

      <div className="analytics-chart-grid">
        <section className="analytics-panel trends-panel">
          <div className="analytics-panel-heading"><div><h2>Execution Trends</h2><p>Daily executions over the last 7 days</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
          <div className="trend-chart" role="img" aria-label="Demo execution trend rising from 1,100 on Monday to 2,100 on Sunday">
            <div className="trend-y-labels"><span>2.5k</span><span>2.0k</span><span>1.5k</span><span>1.0k</span><span>0.5k</span></div>
            <svg viewBox="0 0 700 200" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9b7be5" stopOpacity=".28" /><stop offset="100%" stopColor="#9b7be5" stopOpacity="0" /></linearGradient></defs>
              <path className="trend-grid-line" d="M0 12H700 M0 52H700 M0 92H700 M0 132H700 M0 172H700" />
              <path className="trend-area" d="M10 132 L122 112 L234 123 L346 83 L458 94 L570 59 L690 35 L690 172 L10 172 Z" />
              <path className="trend-line" d="M10 132 L122 112 L234 123 L346 83 L458 94 L570 59 L690 35" />
              <circle className="trend-point" cx="10" cy="132" r="4" /><circle className="trend-point" cx="122" cy="112" r="4" /><circle className="trend-point" cx="234" cy="123" r="4" /><circle className="trend-point" cx="346" cy="83" r="4" /><circle className="trend-point" cx="458" cy="94" r="4" /><circle className="trend-point" cx="570" cy="59" r="4" /><circle className="trend-point" cx="690" cy="35" r="4" />
            </svg>
            <div className="trend-x-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </div>
        </section>

        <section className="analytics-panel success-panel">
          <div className="analytics-panel-heading"><div><h2>Success vs. Failure</h2><p>Execution outcome distribution</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
          <div className="outcome-chart-wrap">
            <div className="outcome-donut" role="img" aria-label="Demo execution outcomes: 95.2 percent success, 3.1 percent failed, 1.7 percent running"><div><strong>95.2%</strong><span>Success</span></div></div>
            <div className="outcome-legend">
              <div><i className="success-dot" /><span>Success</span><strong>95.2%</strong></div>
              <div><i className="failure-dot" /><span>Failed</span><strong>3.1%</strong></div>
              <div><i className="running-dot" /><span>Running</span><strong>1.7%</strong></div>
            </div>
          </div>
        </section>
      </div>

      <div className="analytics-lower-grid">
        <section className="analytics-panel performance-panel">
          <div className="analytics-panel-heading"><div><h2>Agent Performance</h2><p>Execution volume and success rate by agent</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead><tr><th>AGENT</th><th>EXECUTIONS</th><th>SUCCESS RATE</th></tr></thead>
              <tbody>{analyticsAgents.map((agent) => (
                <tr key={agent.name}>
                  <td><div className="agent-cell"><span className={`agent-avatar ${agent.color}`}>{agent.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{agent.name}</strong></div></td>
                  <td><div className="execution-count"><span>{agent.executions.toLocaleString()}</span><span className="mini-bar"><i style={{ width: `${(agent.executions / analyticsAgents[0].executions) * 100}%` }} /></span></div></td>
                  <td><div className="success-rate-cell"><span>{agent.success}%</span><span className="rate-track"><i style={{ width: `${agent.success}%` }} /></span></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="analytics-panel duration-panel">
          <div className="analytics-panel-heading"><div><h2>Execution Duration</h2><p>Average time per agent</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
          <div className="duration-list">
            {durationData.map((agent) => (
              <div className="duration-item" key={agent.name}>
                <div><span>{agent.name}</span><strong>{agent.duration.toFixed(1)}s</strong></div>
                <span className="duration-track"><i className={agent.color} style={{ width: `${(agent.duration / 6) * 100}%` }} /></span>
              </div>
            ))}
          </div>
          <div className="duration-scale"><span>0s</span><span>3s</span><span>6s</span></div>
        </section>
      </div>
    </>
  )
}

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'
type ApprovalRequest = {
  id: string
  agentName: string
  workflowName: string
  action: string
  date: string
  status: ApprovalStatus
  reason: string
}
type ApprovalHistoryEntry = ApprovalRequest & { reviewedBy: string; reviewedAt: string }

const initialApprovalRequests: ApprovalRequest[] = [
  { id: 'APR-028', agentName: 'Customer Support Assistant', workflowName: 'Customer Refund Review', action: 'Issue a $240 refund to order #8472', date: 'Nov 11, 2026 · 9:18 AM', status: 'Pending', reason: 'The customer reported a duplicate charge and the agent recommends a full refund.' },
  { id: 'APR-027', agentName: 'Lead Qualification', workflowName: 'New Lead Qualification', action: 'Send a personalized email to 12 qualified leads', date: 'Nov 11, 2026 · 8:52 AM', status: 'Pending', reason: 'The agent identified 12 high-fit prospects and prepared tailored outreach for review.' },
  { id: 'APR-026', agentName: 'Content Writer', workflowName: 'Weekly Newsletter Draft', action: 'Publish the November product update', date: 'Nov 11, 2026 · 8:30 AM', status: 'Pending', reason: 'A draft newsletter is ready to publish to the subscribed customer list.' },
  { id: 'APR-025', agentName: 'Research Assistant', workflowName: 'Customer Feedback Summary', action: 'Share the feedback report with the product team', date: 'Nov 10, 2026 · 4:12 PM', status: 'Approved', reason: 'The summarized report contains aggregated customer feedback.' },
  { id: 'APR-024', agentName: 'Meeting Notes Organizer', workflowName: 'Meeting Follow-up', action: 'Email action items to all meeting participants', date: 'Nov 10, 2026 · 3:46 PM', status: 'Rejected', reason: 'The draft included an unverified commitment; review the action items before sending.' },
]

const initialApprovalHistory: ApprovalHistoryEntry[] = [
  { id: 'APR-023', agentName: 'Data Enrichment Agent', workflowName: 'Company Data Enrichment', action: 'Update 18 company records in the CRM', date: 'Nov 10, 2026 · 11:24 AM', status: 'Approved', reason: 'Records were checked against the sample source data.', reviewedBy: 'Jordan Lee', reviewedAt: 'Nov 10, 2026 · 11:31 AM' },
  { id: 'APR-022', agentName: 'Lead Qualification', workflowName: 'New Lead Qualification', action: 'Archive 4 low-fit lead records', date: 'Nov 9, 2026 · 2:08 PM', status: 'Rejected', reason: 'The lead records should be reviewed manually before archiving.', reviewedBy: 'Morgan Chen', reviewedAt: 'Nov 9, 2026 · 2:19 PM' },
  { id: 'APR-021', agentName: 'Customer Support Assistant', workflowName: 'Customer Refund Review', action: 'Issue a $86 refund to order #8320', date: 'Nov 9, 2026 · 10:42 AM', status: 'Approved', reason: 'Refund policy criteria were met in the demo scenario.', reviewedBy: 'Jordan Lee', reviewedAt: 'Nov 9, 2026 · 10:47 AM' },
]

function ApprovalsPage() {
  const [requests, setRequests] = useState(initialApprovalRequests)
  const [history, setHistory] = useState(initialApprovalHistory)
  const [statusFilter, setStatusFilter] = useState<'All' | ApprovalStatus>('Pending')
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const query = search.trim().toLowerCase()
  const matchesSearch = (request: ApprovalRequest) => !query || request.agentName.toLowerCase().includes(query) || request.workflowName.toLowerCase().includes(query)
  const filteredRequests = requests.filter((request) => (statusFilter === 'All' || request.status === statusFilter) && matchesSearch(request))
  const filteredHistory = history.filter(matchesSearch).slice(0, 5)
  const counts = {
    total: requests.length,
    pending: requests.filter((request) => request.status === 'Pending').length,
    approved: requests.filter((request) => request.status === 'Approved').length,
    rejected: requests.filter((request) => request.status === 'Rejected').length,
  }
  const summaryCards = [
    { label: 'Total Requests', value: counts.total, icon: '▤', tone: 'blue' },
    { label: 'Pending Requests', value: counts.pending, icon: '◷', tone: 'amber' },
    { label: 'Approved Requests', value: counts.approved, icon: '✓', tone: 'green' },
    { label: 'Rejected Requests', value: counts.rejected, icon: '×', tone: 'rose' },
  ]

  const decideRequest = (request: ApprovalRequest, status: 'Approved' | 'Rejected') => {
    const reviewedAt = 'Nov 11, 2026 · just now'
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item))
    setHistory((current) => [{ ...request, status, reviewedBy: 'You (demo)', reviewedAt }, ...current])
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <div className="heading-title-row"><h1>Human Approvals</h1><span className="demo-badge">Demo Data</span></div>
          <p className="heading-subtitle">Review important actions proposed by your agents before they proceed.</p>
        </div>
      </section>
      <div className="demo-note"><span className="demo-note-dot" /> Approval requests, decisions, and history shown here are sample demo data.</div>

      <section className="stats-grid approval-stats" aria-label="Demo approval statistics">
        {summaryCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <div className="stat-topline"><span>{card.label}</span><span className={`stat-icon ${card.tone}`} aria-hidden="true">{card.icon}</span></div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-change">Demo request count</div>
          </article>
        ))}
      </section>

      <section className="executions-panel approvals-panel">
        <div className="panel-header approvals-header">
          <div><h2>Approval Requests <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Review and decide on actions requested by your agents.</p></div>
          <div className="approval-controls">
            <label className="agent-search approval-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agent or workflow..." aria-label="Search agent or workflow names" /></label>
            <label className="approval-filter"><span className="visually-hidden">Filter approval requests</span>
              <select aria-label="Filter approval requests by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | ApprovalStatus)}>
                <option value="All">All statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="approval-table">
            <thead><tr><th>REQUEST ID</th><th>AGENT NAME</th><th>WORKFLOW NAME</th><th>REQUESTED ACTION</th><th>REQUEST DATE</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td className="execution-id">{request.id}</td><td>{request.agentName}</td><td className="task-cell">{request.workflowName}</td><td className="approval-action-cell">{request.action}</td><td className="muted-cell">{request.date}</td>
                  <td><span className={`status-badge ${request.status.toLowerCase()}`}><i />{request.status}</span></td>
                  <td><div className="approval-row-actions"><button className="details-button" type="button" onClick={() => setSelectedRequest(request)}>Details</button>{request.status === 'Pending' && <><button className="decision-button approve" type="button" onClick={() => decideRequest(request, 'Approved')}>Approve</button><button className="decision-button reject" type="button" onClick={() => decideRequest(request, 'Rejected')}>Reject</button></>}</div></td>
                </tr>
              ))}
              {filteredRequests.length === 0 && <tr><td colSpan={7} className="execution-empty">No demo approval requests match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{filteredRequests.length}</strong> of <strong>{requests.length}</strong> demo requests</span><span className="demo-footer-label">Demo data</span></div>
      </section>

      <section className="executions-panel approval-history-panel">
        <div className="panel-header approval-history-heading"><div><h2>Decision History</h2><p>Previously approved and rejected demo requests.</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
        {filteredHistory.length > 0 ? <div className="approval-history-list">
          {filteredHistory.map((entry) => (
            <article className="history-item" key={`${entry.id}-${entry.reviewedAt}`}>
              <span className={`history-icon ${entry.status.toLowerCase()}`}>{entry.status === 'Approved' ? '✓' : '×'}</span>
              <div className="history-main"><div><strong>{entry.id}</strong><span className={`status-badge ${entry.status.toLowerCase()}`}><i />{entry.status}</span></div><p><b>{entry.agentName}</b> · {entry.workflowName} — {entry.action}</p><small>Reviewed by {entry.reviewedBy} · {entry.reviewedAt}</small></div>
              <button className="details-button history-details" type="button" onClick={() => setSelectedRequest(entry)}>Details</button>
            </article>
          ))}
        </div> : <div className="execution-empty history-empty">No demo decisions match this search.</div>}
      </section>

      {selectedRequest && <div className="execution-modal-backdrop" onClick={() => setSelectedRequest(null)}>
        <section className="execution-modal approval-detail-modal" role="dialog" aria-modal="true" aria-labelledby="approval-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="execution-modal-heading"><div><span className="detail-label">DEMO APPROVAL REQUEST</span><h2 id="approval-detail-title">{selectedRequest.id}</h2></div><button type="button" className="modal-close" aria-label="Close request details" onClick={() => setSelectedRequest(null)}>×</button></div>
          <span className={`status-badge ${selectedRequest.status.toLowerCase()}`}><i />{selectedRequest.status}</span>
          <div className="execution-modal-grid"><div><span>Agent</span><strong>{selectedRequest.agentName}</strong></div><div><span>Workflow</span><strong>{selectedRequest.workflowName}</strong></div><div><span>Requested action</span><strong>{selectedRequest.action}</strong></div><div><span>Request date</span><strong>{selectedRequest.date}</strong></div></div>
          <div className="execution-detail-message"><span>Why this needs review</span><p>{selectedRequest.reason}</p></div>
          <button className="secondary-button modal-dismiss" type="button" onClick={() => setSelectedRequest(null)}>Close</button>
        </section>
      </div>}
    </>
  )
}

type LogLevel = 'INFO' | 'WARNING' | 'ERROR'
type DemoLogEntry = {
  timestamp: string
  level: LogLevel
  agentName: string
  workflowName: string
  executionId: string
  message: string
}

const demoLogEntries: DemoLogEntry[] = [
  { timestamp: 'Nov 11, 2026 · 9:32:18 AM', level: 'INFO', agentName: 'Customer Support Assistant', workflowName: 'Support Ticket Triage', executionId: 'EX-1042', message: 'Ticket categorized as billing inquiry. Draft response created and queued for review.' },
  { timestamp: 'Nov 11, 2026 · 9:28:42 AM', level: 'INFO', agentName: 'Lead Qualification', workflowName: 'New Lead Qualification', executionId: 'EX-1041', message: 'Company research completed. Lead fit score calculated as 87/100.' },
  { timestamp: 'Nov 11, 2026 · 9:25:07 AM', level: 'WARNING', agentName: 'Data Enrichment Agent', workflowName: 'Company Data Enrichment', executionId: 'EX-1040', message: 'Two optional company fields were not found in the sample source. Existing values were preserved.' },
  { timestamp: 'Nov 11, 2026 · 9:14:33 AM', level: 'ERROR', agentName: 'Content Writer', workflowName: 'Weekly Newsletter Draft', executionId: 'EX-1039', message: 'Content source returned an empty response. Draft generation stopped before publishing.' },
  { timestamp: 'Nov 11, 2026 · 9:06:51 AM', level: 'INFO', agentName: 'Research Assistant', workflowName: 'Customer Feedback Summary', executionId: 'EX-1038', message: 'Feedback grouped into three themes. Summary contains 24 sample responses.' },
  { timestamp: 'Nov 11, 2026 · 8:58:14 AM', level: 'WARNING', agentName: 'Meeting Notes Organizer', workflowName: 'Meeting Follow-up', executionId: 'EX-1037', message: 'Transcript is longer than the preferred input size. Processing continued with a shortened sample.' },
  { timestamp: 'Nov 10, 2026 · 4:52:29 PM', level: 'INFO', agentName: 'Customer Support Assistant', workflowName: 'Support Ticket Triage', executionId: 'EX-1036', message: 'Ticket routed to the billing queue. Classification confidence: 96%.' },
  { timestamp: 'Nov 10, 2026 · 4:40:03 PM', level: 'ERROR', agentName: 'Lead Qualification', workflowName: 'New Lead Qualification', executionId: 'EX-1035', message: 'CRM sample endpoint timed out after three attempts. Workflow run marked for retry.' },
  { timestamp: 'Nov 10, 2026 · 4:31:46 PM', level: 'INFO', agentName: 'Data Enrichment Agent', workflowName: 'Company Data Enrichment', executionId: 'EX-1034', message: 'Company profile updated with verified industry and employee range.' },
  { timestamp: 'Nov 10, 2026 · 3:58:11 PM', level: 'WARNING', agentName: 'Content Writer', workflowName: 'Weekly Newsletter Draft', executionId: 'EX-1033', message: 'Brand voice score was below the preferred threshold. Review suggested before approval.' },
]

function LogsPage() {
  const [levelFilter, setLevelFilter] = useState<'ALL' | LogLevel>('ALL')
  const [search, setSearch] = useState('')
  const [selectedLog, setSelectedLog] = useState<DemoLogEntry | null>(null)
  const query = search.trim().toLowerCase()
  const filteredLogs = demoLogEntries.filter((entry) => {
    const matchesLevel = levelFilter === 'ALL' || entry.level === levelFilter
    const searchableText = `${entry.message} ${entry.agentName} ${entry.workflowName}`.toLowerCase()
    return matchesLevel && (!query || searchableText.includes(query))
  })
  const stats = [
    { label: 'Total Log Entries', count: demoLogEntries.length, tone: 'blue', icon: '≡' },
    { label: 'Info Messages', count: demoLogEntries.filter((entry) => entry.level === 'INFO').length, tone: 'green', icon: 'i' },
    { label: 'Warning Messages', count: demoLogEntries.filter((entry) => entry.level === 'WARNING').length, tone: 'amber', icon: '!' },
    { label: 'Error Messages', count: demoLogEntries.filter((entry) => entry.level === 'ERROR').length, tone: 'rose', icon: '×' },
  ]

  const openLog = (entry: DemoLogEntry) => setSelectedLog(entry)
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, entry: DemoLogEntry) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openLog(entry)
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <div className="heading-title-row"><h1>Execution Logs</h1><span className="demo-badge">Demo Data</span></div>
          <p className="heading-subtitle">Inspect messages and events recorded during agent workflow runs.</p>
        </div>
      </section>
      <div className="demo-note"><span className="demo-note-dot" /> Log entries and counts below are sample demo data.</div>

      <section className="stats-grid logs-stats" aria-label="Demo log statistics">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-topline"><span>{stat.label}</span><span className={`stat-icon ${stat.tone}`} aria-hidden="true">{stat.icon}</span></div>
            <div className="stat-value">{stat.count}</div>
            <div className="stat-change">Demo log entries</div>
          </article>
        ))}
      </section>

      <section className="executions-panel logs-panel">
        <div className="panel-header logs-panel-header">
          <div><h2>Agent Execution Logs <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Click a log entry to inspect its full details.</p></div>
          <div className="logs-controls">
            <label className="agent-search logs-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages, agents, workflows..." aria-label="Search log messages, agent names, and workflow names" /></label>
            <label className="logs-level-filter"><span className="visually-hidden">Filter log level</span>
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as 'ALL' | LogLevel)} aria-label="Filter log entries by level">
                <option value="ALL">All levels</option><option value="INFO">INFO</option><option value="WARNING">WARNING</option><option value="ERROR">ERROR</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="logs-table">
            <thead><tr><th>TIMESTAMP</th><th>LEVEL</th><th>AGENT NAME</th><th>WORKFLOW NAME</th><th>EXECUTION ID</th><th>LOG MESSAGE</th></tr></thead>
            <tbody>
              {filteredLogs.map((entry) => (
                <tr key={`${entry.executionId}-${entry.timestamp}`} onClick={() => openLog(entry)} onKeyDown={(event) => handleRowKeyDown(event, entry)} tabIndex={0} role="button" aria-label={`View ${entry.level} log from ${entry.agentName} in ${entry.workflowName}`}>
                  <td className="muted-cell">{entry.timestamp}</td><td><span className={`log-level ${entry.level.toLowerCase()}`}>{entry.level}</span></td><td>{entry.agentName}</td><td className="task-cell">{entry.workflowName}</td><td className="execution-id">{entry.executionId}</td><td className="log-message-cell">{entry.message}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && <tr><td className="execution-empty" colSpan={6}>No demo logs match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{filteredLogs.length}</strong> of <strong>{demoLogEntries.length}</strong> sample log entries</span><span className="demo-footer-label">Demo data</span></div>
      </section>

      {selectedLog && <div className="execution-modal-backdrop" onClick={() => setSelectedLog(null)}>
        <section className="execution-modal log-detail-modal" role="dialog" aria-modal="true" aria-labelledby="log-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="execution-modal-heading"><div><span className="detail-label">DEMO LOG ENTRY</span><h2 id="log-detail-title">{selectedLog.executionId}</h2></div><button className="modal-close" type="button" aria-label="Close log details" onClick={() => setSelectedLog(null)}>×</button></div>
          <span className={`log-level ${selectedLog.level.toLowerCase()}`}>{selectedLog.level}</span>
          <div className="execution-modal-grid"><div><span>Timestamp</span><strong>{selectedLog.timestamp}</strong></div><div><span>Agent</span><strong>{selectedLog.agentName}</strong></div><div><span>Workflow</span><strong>{selectedLog.workflowName}</strong></div><div><span>Execution ID</span><strong>{selectedLog.executionId}</strong></div></div>
          <div className="execution-detail-message"><span>Full log message</span><p>{selectedLog.message}</p></div>
          <button className="secondary-button modal-dismiss" type="button" onClick={() => setSelectedLog(null)}>Close</button>
        </section>
      </div>}
    </>
  )
}

type ErrorStatus = 'Unresolved' | 'Resolved'
type RetryStatus = 'Not Retried' | 'Retry Successful' | 'Retry Failed'
type DemoError = {
  id: string
  agentName: string
  workflowName: string
  message: string
  dateTime: string
  errorStatus: ErrorStatus
  retryStatus: RetryStatus
  retryAttempts: number
  nextRetrySucceeds: boolean
  details: string
}

const initialDemoErrors: DemoError[] = [
  { id: 'EX-1039', agentName: 'Content Writer', workflowName: 'Weekly Newsletter Draft', message: 'Content source returned an empty response.', dateTime: 'Nov 11, 2026 · 9:14 AM', errorStatus: 'Unresolved', retryStatus: 'Not Retried', retryAttempts: 0, nextRetrySucceeds: true, details: 'The content source returned an empty response after the request timed out. The draft was not generated or published. A retry will use the same workflow configuration.' },
  { id: 'EX-1035', agentName: 'Lead Qualification', workflowName: 'New Lead Qualification', message: 'CRM sample endpoint timed out after three attempts.', dateTime: 'Nov 10, 2026 · 4:40 PM', errorStatus: 'Unresolved', retryStatus: 'Retry Failed', retryAttempts: 1, nextRetrySucceeds: true, details: 'The sample CRM endpoint did not respond within the configured timeout. The first retry also timed out; another retry is available.' },
  { id: 'EX-1028', agentName: 'Meeting Notes Organizer', workflowName: 'Meeting Follow-up', message: 'Transcript was missing from the meeting record.', dateTime: 'Nov 10, 2026 · 1:26 PM', errorStatus: 'Resolved', retryStatus: 'Retry Successful', retryAttempts: 1, nextRetrySucceeds: false, details: 'The first run could not find a transcript. A later demo retry succeeded after the sample transcript became available.' },
  { id: 'EX-1024', agentName: 'Data Enrichment Agent', workflowName: 'Company Data Enrichment', message: 'Rate limit reached while requesting company profile data.', dateTime: 'Nov 9, 2026 · 3:08 PM', errorStatus: 'Unresolved', retryStatus: 'Retry Failed', retryAttempts: 2, nextRetrySucceeds: true, details: 'The data provider returned a rate limit response. Two sample retry attempts have not succeeded; this error remains unresolved.' },
  { id: 'EX-1021', agentName: 'Customer Support Assistant', workflowName: 'Support Ticket Triage', message: 'Response validation failed: required resolution summary was empty.', dateTime: 'Nov 9, 2026 · 11:42 AM', errorStatus: 'Resolved', retryStatus: 'Retry Successful', retryAttempts: 2, nextRetrySucceeds: true, details: 'The initial response was missing its resolution summary. A retry generated a complete response and the demo run was marked resolved.' },
  { id: 'EX-1018', agentName: 'Research Assistant', workflowName: 'Customer Feedback Summary', message: 'One feedback source could not be parsed.', dateTime: 'Nov 8, 2026 · 2:16 PM', errorStatus: 'Resolved', retryStatus: 'Not Retried', retryAttempts: 0, nextRetrySucceeds: true, details: 'The issue was resolved by excluding the unsupported sample source. No retry was needed.' },
]

function ErrorsPage() {
  const [errors, setErrors] = useState(initialDemoErrors)
  const [errorFilter, setErrorFilter] = useState<'ALL' | ErrorStatus>('ALL')
  const [retryFilter, setRetryFilter] = useState<'ALL' | RetryStatus>('ALL')
  const [search, setSearch] = useState('')
  const [selectedError, setSelectedError] = useState<DemoError | null>(null)
  const query = search.trim().toLowerCase()
  const filteredErrors = errors.filter((error) => {
    const matchesErrorStatus = errorFilter === 'ALL' || error.errorStatus === errorFilter
    const matchesRetryStatus = retryFilter === 'ALL' || error.retryStatus === retryFilter
    const searchable = `${error.id} ${error.agentName} ${error.workflowName} ${error.message}`.toLowerCase()
    return matchesErrorStatus && matchesRetryStatus && (!query || searchable.includes(query))
  })
  const totalRetryAttempts = errors.reduce((total, error) => total + error.retryAttempts, 0)
  const metrics = [
    { label: 'Total Errors', value: errors.length, icon: '!', tone: 'rose', note: 'Demo error records' },
    { label: 'Unresolved Errors', value: errors.filter((error) => error.errorStatus === 'Unresolved').length, icon: '◷', tone: 'amber', note: 'Need attention' },
    { label: 'Resolved Errors', value: errors.filter((error) => error.errorStatus === 'Resolved').length, icon: '✓', tone: 'green', note: 'Resolved demo records' },
    { label: 'Retry Attempts', value: totalRetryAttempts, icon: '↻', tone: 'blue', note: 'Across sample errors' },
  ]

  const retryError = (errorId: string) => {
    setErrors((currentErrors) => currentErrors.map((error) => {
      if (error.id !== errorId || error.errorStatus === 'Resolved') return error
      const retrySucceeded = error.nextRetrySucceeds
      return {
        ...error,
        retryAttempts: error.retryAttempts + 1,
        retryStatus: retrySucceeded ? 'Retry Successful' : 'Retry Failed',
        errorStatus: retrySucceeded ? 'Resolved' : 'Unresolved',
        nextRetrySucceeds: !error.nextRetrySucceeds,
        details: retrySucceeded
          ? `${error.details} The latest demo retry succeeded and this error is now resolved.`
          : `${error.details} The latest demo retry was unsuccessful; the error remains unresolved.`,
      }
    }))
  }

  const statusClass = (status: ErrorStatus) => status.toLowerCase()
  const retryClass = (status: RetryStatus) => status === 'Retry Successful' ? 'success' : status === 'Retry Failed' ? 'failed' : 'not-retried'

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">WORKSPACE</p><div className="heading-title-row"><h1>Error Tracking</h1><span className="demo-badge">Demo Data</span></div><p className="heading-subtitle">Review failed agent runs, inspect error details, and retry recoverable executions.</p></div>
      </section>
      <div className="demo-note"><span className="demo-note-dot" /> Error records, retry attempts, and outcomes are sample demo data. Retry actions run locally in this page.</div>

      <section className="stats-grid errors-stats" aria-label="Demo error statistics">
        {metrics.map((metric) => <article className="stat-card" key={metric.label}>
          <div className="stat-topline"><span>{metric.label}</span><span className={`stat-icon ${metric.tone}`} aria-hidden="true">{metric.icon}</span></div><div className="stat-value">{metric.value}</div><div className="stat-change">{metric.note}</div>
        </article>)}
      </section>

      <section className="executions-panel errors-panel">
        <div className="panel-header errors-panel-header">
          <div><h2>Failed Executions <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Select an error to view details or retry an unresolved execution.</p></div>
          <div className="errors-controls">
            <label className="agent-search errors-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search errors, agents, workflows..." aria-label="Search errors, agent names, and workflow names" /></label>
            <label className="error-filter"><span className="visually-hidden">Filter error status</span><select value={errorFilter} onChange={(event) => setErrorFilter(event.target.value as 'ALL' | ErrorStatus)} aria-label="Filter by error status"><option value="ALL">All error statuses</option><option value="Unresolved">Unresolved</option><option value="Resolved">Resolved</option></select></label>
            <label className="error-filter"><span className="visually-hidden">Filter retry status</span><select value={retryFilter} onChange={(event) => setRetryFilter(event.target.value as 'ALL' | RetryStatus)} aria-label="Filter by retry status"><option value="ALL">All retry statuses</option><option value="Not Retried">Not Retried</option><option value="Retry Successful">Retry Successful</option><option value="Retry Failed">Retry Failed</option></select></label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="errors-table">
            <thead><tr><th>EXECUTION ID</th><th>AGENT NAME</th><th>WORKFLOW NAME</th><th>ERROR MESSAGE</th><th>ERROR DATE &amp; TIME</th><th>ERROR STATUS</th><th>RETRY STATUS</th><th>ACTION</th></tr></thead>
            <tbody>
              {filteredErrors.map((error) => (
                <tr key={error.id} className="error-row" tabIndex={0} role="button" aria-label={`View error details for ${error.id}`} onClick={() => setSelectedError(error)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedError(error)
                  }
                }}>
                  <td className="execution-id">{error.id}</td><td>{error.agentName}</td><td className="task-cell">{error.workflowName}</td><td className="error-message-cell" title={error.message}>{error.message}</td><td className="muted-cell">{error.dateTime}</td>
                  <td><span className={`error-state ${statusClass(error.errorStatus)}`}><i />{error.errorStatus}</span></td>
                  <td><span className={`retry-state ${retryClass(error.retryStatus)}`}>{error.retryStatus}</span>{error.retryAttempts > 0 && <small className="retry-count">{error.retryAttempts} attempt{error.retryAttempts === 1 ? '' : 's'}</small>}</td>
                  <td><button className="retry-button" type="button" disabled={error.errorStatus === 'Resolved'} onClick={(event) => { event.stopPropagation(); retryError(error.id) }}>{error.errorStatus === 'Resolved' ? 'Resolved' : 'Retry'}</button></td>
                </tr>
              ))}
              {filteredErrors.length === 0 && <tr><td colSpan={8} className="execution-empty">No demo errors match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{filteredErrors.length}</strong> of <strong>{errors.length}</strong> demo errors</span><span className="demo-footer-label">Demo data</span></div>
      </section>

      {selectedError && <div className="execution-modal-backdrop" onClick={() => setSelectedError(null)}>
        <section className="execution-modal error-detail-modal" role="dialog" aria-modal="true" aria-labelledby="error-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="execution-modal-heading"><div><span className="detail-label">DEMO EXECUTION ERROR</span><h2 id="error-detail-title">{selectedError.id}</h2></div><button className="modal-close" type="button" aria-label="Close error details" onClick={() => setSelectedError(null)}>×</button></div>
          <div className="error-detail-badges"><span className={`error-state ${statusClass(selectedError.errorStatus)}`}><i />{selectedError.errorStatus}</span><span className={`retry-state ${retryClass(selectedError.retryStatus)}`}>{selectedError.retryStatus}</span></div>
          <div className="execution-modal-grid"><div><span>Agent</span><strong>{selectedError.agentName}</strong></div><div><span>Workflow</span><strong>{selectedError.workflowName}</strong></div><div><span>Error date and time</span><strong>{selectedError.dateTime}</strong></div><div><span>Retry attempts</span><strong>{selectedError.retryAttempts}</strong></div></div>
          <div className="execution-detail-message error"><span>Error message</span><p>{selectedError.message}</p></div>
          <div className="execution-detail-message"><span>Full details</span><p>{selectedError.details}</p></div>
          <button className="secondary-button modal-dismiss" type="button" onClick={() => setSelectedError(null)}>Close</button>
        </section>
      </div>}
    </>
  )
}

type UserRole = 'Admin' | 'Developer' | 'Viewer'
type AccessStatus = 'Active' | 'Inactive'
type DemoUser = { id: string; name: string; email: string; role: UserRole; accessStatus: AccessStatus; lastActive: string }
type AuditEntry = { id: string; timestamp: string; actor: string; action: string; target: string }

const initialDemoUsers: DemoUser[] = [
  { id: 'USR-104', name: 'Avery Patel', email: 'avery.patel@example.com', role: 'Admin', accessStatus: 'Active', lastActive: 'Just now' },
  { id: 'USR-103', name: 'Jordan Lee', email: 'jordan.lee@example.com', role: 'Developer', accessStatus: 'Active', lastActive: '12 minutes ago' },
  { id: 'USR-102', name: 'Morgan Chen', email: 'morgan.chen@example.com', role: 'Viewer', accessStatus: 'Active', lastActive: '1 hour ago' },
  { id: 'USR-101', name: 'Riley Brooks', email: 'riley.brooks@example.com', role: 'Developer', accessStatus: 'Inactive', lastActive: 'Nov 7, 2026' },
  { id: 'USR-100', name: 'Casey Rivera', email: 'casey.rivera@example.com', role: 'Viewer', accessStatus: 'Active', lastActive: 'Yesterday' },
  { id: 'USR-099', name: 'Taylor Kim', email: 'taylor.kim@example.com', role: 'Admin', accessStatus: 'Inactive', lastActive: 'Nov 3, 2026' },
]

const initialAuditEntries: AuditEntry[] = [
  { id: 'AUD-208', timestamp: 'Nov 11, 2026 · 9:20 AM', actor: 'Avery Patel', action: 'Changed role from Viewer to Developer', target: 'Jordan Lee' },
  { id: 'AUD-207', timestamp: 'Nov 11, 2026 · 8:54 AM', actor: 'System (demo)', action: 'Successful sign-in', target: 'Morgan Chen' },
  { id: 'AUD-206', timestamp: 'Nov 10, 2026 · 4:32 PM', actor: 'Avery Patel', action: 'Invited a new workspace member', target: 'Riley Brooks' },
  { id: 'AUD-205', timestamp: 'Nov 10, 2026 · 3:16 PM', actor: 'System (demo)', action: 'Failed sign-in attempt', target: 'taylor.kim@example.com' },
]

const rolePermissions: Record<UserRole, Record<string, string>> = {
  Admin: {
    'Agent Management': 'View, create, edit, and remove agents',
    'Workflow Management': 'View, create, edit, run, and remove workflows',
    'Execution Logs': 'View and export execution logs',
    'Human Approvals': 'Review, approve, and reject requests',
    Analytics: 'View all analytics and usage reports',
    'Security Settings': 'Manage users, roles, and workspace settings',
  },
  Developer: {
    'Agent Management': 'View, create, and edit agents',
    'Workflow Management': 'View, create, edit, and run workflows',
    'Execution Logs': 'View execution logs',
    'Human Approvals': 'Submit requests for review',
    Analytics: 'View analytics and usage reports',
    'Security Settings': 'No access',
  },
  Viewer: {
    'Agent Management': 'View agents',
    'Workflow Management': 'View workflows',
    'Execution Logs': 'View execution logs',
    'Human Approvals': 'View request status',
    Analytics: 'View summary analytics',
    'Security Settings': 'No access',
  },
}

const permissionSections = ['Agent Management', 'Workflow Management', 'Execution Logs', 'Human Approvals', 'Analytics', 'Security Settings']

function SecurityPage() {
  const [users, setUsers] = useState(initialDemoUsers)
  const [auditEntries, setAuditEntries] = useState(initialAuditEntries)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All')
  const [accessFilter, setAccessFilter] = useState<'All' | AccessStatus>('All')
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null)
  const query = search.trim().toLowerCase()
  const filteredUsers = users.filter((user) => {
    const matchesQuery = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    return matchesQuery && (roleFilter === 'All' || user.role === roleFilter) && (accessFilter === 'All' || user.accessStatus === accessFilter)
  })
  const userMetrics = [
    { label: 'Total Users', value: users.length, tone: 'blue', icon: '♙', note: 'Demo workspace users' },
    { label: 'Active Users', value: users.filter((user) => user.accessStatus === 'Active').length, tone: 'green', icon: '◉', note: 'Active demo accounts' },
    { label: 'Admin Users', value: users.filter((user) => user.role === 'Admin').length, tone: 'violet', icon: '◇', note: 'Assigned demo role' },
    { label: 'Inactive Users', value: users.filter((user) => user.accessStatus === 'Inactive').length, tone: 'amber', icon: '○', note: 'Inactive demo accounts' },
  ]

  const updateUserRole = (userId: string, nextRole: UserRole) => {
    const user = users.find((item) => item.id === userId)
    if (!user || user.role === nextRole) return
    setUsers((current) => current.map((item) => item.id === userId ? { ...item, role: nextRole } : item))
    setAuditEntries((current) => [{ id: `AUD-${Date.now()}`, timestamp: 'Nov 11, 2026 · just now', actor: 'You (demo)', action: `Changed role from ${user.role} to ${nextRole}`, target: user.name }, ...current])
    setSelectedUser((current) => current?.id === userId ? { ...current, role: nextRole } : current)
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">WORKSPACE</p><div className="heading-title-row"><h1>Permissions &amp; Security</h1><span className="demo-badge">Demo Data</span></div><p className="heading-subtitle">Review demo user access, role permissions, and security activity.</p></div>
      </section>
      <div className="security-demo-notice"><span className="demo-note-dot" /><div><strong>Frontend demo only</strong><span>These sample roles and permissions do not enforce or restrict actual backend access.</span></div><span className="demo-badge">Demo Data</span></div>

      <section className="stats-grid security-stats" aria-label="Demo user statistics">
        {userMetrics.map((metric) => <article className="stat-card" key={metric.label}>
          <div className="stat-topline"><span>{metric.label}</span><span className={`stat-icon ${metric.tone}`} aria-hidden="true">{metric.icon}</span></div><div className="stat-value">{metric.value}</div><div className="stat-change">{metric.note}</div>
        </article>)}
      </section>

      <section className="executions-panel security-users-panel">
        <div className="panel-header security-users-header">
          <div><h2>User Management <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Search members, inspect access, or change a demo role.</p></div>
          <div className="security-controls">
            <label className="agent-search security-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." aria-label="Search users by name or email" /></label>
            <label className="security-filter"><span className="visually-hidden">Filter by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'All' | UserRole)} aria-label="Filter users by role"><option value="All">All roles</option><option value="Admin">Admin</option><option value="Developer">Developer</option><option value="Viewer">Viewer</option></select></label>
            <label className="security-filter"><span className="visually-hidden">Filter by access status</span><select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as 'All' | AccessStatus)} aria-label="Filter users by access status"><option value="All">All access</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="security-users-table">
            <thead><tr><th>USER NAME</th><th>EMAIL</th><th>ROLE</th><th>ACCESS STATUS</th><th>LAST ACTIVE</th><th>DETAILS</th></tr></thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td><div className="user-name-cell"><span className={`user-initials ${user.role.toLowerCase()}`}>{user.name.split(' ').map((part) => part[0]).join('')}</span><strong>{user.name}</strong></div></td>
                  <td className="muted-cell">{user.email}</td>
                  <td><label className="user-role-select"><span className="visually-hidden">Edit demo role for {user.name}</span><select value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value as UserRole)} aria-label={`Edit demo role for ${user.name}`}><option>Admin</option><option>Developer</option><option>Viewer</option></select></label></td>
                  <td><span className={`access-state ${user.accessStatus.toLowerCase()}`}><i />{user.accessStatus}</span></td>
                  <td className="muted-cell">{user.lastActive}</td>
                  <td><button className="details-button" type="button" onClick={() => setSelectedUser(user)}>View details</button></td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={6} className="execution-empty">No demo users match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> demo users</span><span className="demo-footer-label">Demo data</span></div>
      </section>

      <section className="executions-panel permissions-panel">
        <div className="panel-header"><div><h2>Role Permissions</h2><p>Example section access and actions by role. Demo only.</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
        <div className="table-wrap">
          <table className="permissions-table">
            <thead><tr><th>SECTION</th><th>ADMIN</th><th>DEVELOPER</th><th>VIEWER</th></tr></thead>
            <tbody>{permissionSections.map((section) => <tr key={section}><td><strong>{section}</strong></td><td>{rolePermissions.Admin[section]}</td><td>{rolePermissions.Developer[section]}</td><td>{rolePermissions.Viewer[section]}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="executions-panel audit-panel">
        <div className="panel-header"><div><h2>Audit Logs</h2><p>Sample role changes and security-related activity.</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
        <div className="table-wrap">
          <table className="audit-table"><thead><tr><th>TIMESTAMP</th><th>ACTOR</th><th>ACTIVITY</th><th>USER / TARGET</th></tr></thead>
            <tbody>{auditEntries.slice(0, 6).map((entry) => <tr key={entry.id}><td className="muted-cell">{entry.timestamp}</td><td>{entry.actor}</td><td>{entry.action}</td><td className="task-cell">{entry.target}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {selectedUser && <div className="execution-modal-backdrop" onClick={() => setSelectedUser(null)}>
        <section className="execution-modal user-detail-modal" role="dialog" aria-modal="true" aria-labelledby="user-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="execution-modal-heading"><div><span className="detail-label">DEMO USER DETAILS</span><h2 id="user-detail-title">{selectedUser.name}</h2></div><button className="modal-close" type="button" aria-label="Close user details" onClick={() => setSelectedUser(null)}>×</button></div>
          <div className="user-detail-summary"><span className={`user-initials ${selectedUser.role.toLowerCase()}`}>{selectedUser.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{selectedUser.email}</strong><span>{selectedUser.role} · {selectedUser.accessStatus}</span></div></div>
          <div className="user-permission-list"><div className="user-permission-heading"><strong>Assigned permissions</strong><span className="demo-badge">Demo Data</span></div>
            {permissionSections.map((section) => <div className="user-permission-row" key={section}><span>{section}</span><strong>{rolePermissions[selectedUser.role][section]}</strong></div>)}
          </div>
          <div className="security-detail-disclaimer">These demo permissions do not enforce actual application or backend access.</div>
          <button className="secondary-button modal-dismiss" type="button" onClick={() => setSelectedUser(null)}>Close</button>
        </section>
      </div>}
    </>
  )
}

function MonitoringPage() {
  const [statusFilter, setStatusFilter] = useState<'All' | ExecutionStatus>('All')
  const [search, setSearch] = useState('')
  const [selectedExecution, setSelectedExecution] = useState<DemoExecution | null>(null)
  const query = search.trim().toLowerCase()
  const filteredExecutions = demoExecutionHistory.filter((execution) => {
    const matchesStatus = statusFilter === 'All' || execution.status === statusFilter
    const matchesSearch = !query || execution.workflowName.toLowerCase().includes(query) || execution.agentName.toLowerCase().includes(query)
    return matchesStatus && matchesSearch
  })

  const metricCards = [
    { label: 'Total Executions', value: '1,284', note: 'Demo records this month', icon: '↗', tone: 'blue' },
    { label: 'Successful Executions', value: '1,236', note: '96.3% success rate', icon: '✓', tone: 'green' },
    { label: 'Failed Executions', value: '32', note: '2.5% of executions', icon: '!', tone: 'rose' },
    { label: 'Average Execution Time', value: '2.8s', note: 'Across completed runs', icon: '◷', tone: 'violet' },
  ]

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <div className="heading-title-row"><h1>Monitoring</h1><span className="demo-badge">Demo Data</span></div>
          <p className="heading-subtitle">Track workflow runs, execution health, and recent activity.</p>
        </div>
      </section>

      <div className="demo-note"><span className="demo-note-dot" /> Statistics and execution history below are sample demo data.</div>

      <section className="stats-grid monitoring-stats" aria-label="Demo execution statistics">
        {metricCards.map((metric) => (
          <article className="stat-card" key={metric.label}>
            <div className="stat-topline"><span>{metric.label}</span><span className={`stat-icon ${metric.tone}`} aria-hidden="true">{metric.icon}</span></div>
            <div className="stat-value">{metric.value}</div>
            <div className="stat-change">{metric.note}</div>
          </article>
        ))}
      </section>

      <section className="executions-panel monitoring-panel">
        <div className="panel-header monitoring-panel-header">
          <div><h2>Execution History <span className="demo-badge panel-demo-badge">Demo Data</span></h2><p>Recent sample runs from your workflows and agents.</p></div>
          <div className="execution-filters">
            <label className="status-filter"><span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | ExecutionStatus)} aria-label="Filter executions by status">
                <option value="All">All statuses</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
                <option value="Running">Running</option>
              </select>
            </label>
            <label className="agent-search monitoring-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workflow or agent..." aria-label="Search by workflow or agent name" />
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table className="execution-history-table">
            <thead><tr><th>EXECUTION ID</th><th>WORKFLOW NAME</th><th>AGENT NAME</th><th>STATUS</th><th>EXECUTION TIME</th><th>DATE &amp; TIME</th><th><span className="visually-hidden">Details</span></th></tr></thead>
            <tbody>
              {filteredExecutions.map((execution) => (
                <tr key={execution.id}>
                  <td className="execution-id">{execution.id}</td>
                  <td>{execution.workflowName}</td>
                  <td className="task-cell">{execution.agentName}</td>
                  <td><span className={`status-badge ${execution.status.toLowerCase() === 'success' ? 'completed' : execution.status.toLowerCase()}`}><i />{execution.status}</span></td>
                  <td className="duration-cell">{execution.duration}</td>
                  <td className="muted-cell">{execution.dateTime}</td>
                  <td><button className="details-button" type="button" onClick={() => setSelectedExecution(execution)}>{execution.status === 'Failed' ? 'View error' : 'Details'}</button></td>
                </tr>
              ))}
              {filteredExecutions.length === 0 && <tr><td colSpan={7} className="execution-empty">No demo executions match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Showing <strong>{filteredExecutions.length}</strong> of <strong>{demoExecutionHistory.length}</strong> sample executions</span><span className="demo-footer-label">Demo data</span></div>
      </section>

      {selectedExecution && <div className="execution-modal-backdrop" onClick={() => setSelectedExecution(null)}>
        <section className="execution-modal" role="dialog" aria-modal="true" aria-labelledby="execution-detail-title" onClick={(event) => event.stopPropagation()}>
          <div className="execution-modal-heading"><div><span className="detail-label">DEMO EXECUTION</span><h2 id="execution-detail-title">{selectedExecution.id}</h2></div><button type="button" className="modal-close" aria-label="Close details" onClick={() => setSelectedExecution(null)}>×</button></div>
          <span className={`status-badge ${selectedExecution.status.toLowerCase() === 'success' ? 'completed' : selectedExecution.status.toLowerCase()}`}><i />{selectedExecution.status}</span>
          <div className="execution-modal-grid"><div><span>Workflow</span><strong>{selectedExecution.workflowName}</strong></div><div><span>Agent</span><strong>{selectedExecution.agentName}</strong></div><div><span>Execution time</span><strong>{selectedExecution.duration}</strong></div><div><span>Date and time</span><strong>{selectedExecution.dateTime}</strong></div></div>
          <div className={`execution-detail-message ${selectedExecution.status === 'Failed' ? 'error' : ''}`}><span>{selectedExecution.status === 'Failed' ? 'Error details' : 'Execution details'}</span><p>{selectedExecution.details}</p></div>
          <button className="secondary-button modal-dismiss" type="button" onClick={() => setSelectedExecution(null)}>Close</button>
        </section>
      </div>}
    </>
  )
}

type DemoAgent = (typeof demoAgents)[number]

function AgentDetails({ agent, onBack }: { agent: DemoAgent; onBack: () => void }) {
  return (
    <>
      <section className="page-heading details-heading">
        <div>
          <p className="eyebrow">AGENTS / DETAILS</p>
          <div className="heading-title-row"><h1>{agent.name}</h1><span className="demo-badge">Demo Data</span></div>
          <p className="heading-subtitle">{agent.description}</p>
        </div>
        <div className="details-actions">
          <button className="secondary-button" type="button" onClick={onBack}>← Back to Agents</button>
          <button className="primary-button" type="button"><span>✎</span> Edit</button>
        </div>
      </section>

      <div className="demo-note"><span className="demo-note-dot" /> Demo agent details and configuration. Changes are not connected to a backend.</div>

      <section className="details-summary">
        <div className="details-agent-icon"><span className={`agent-avatar agent-card-avatar ${agent.color}`}>{agent.initials}</span></div>
        <div className="details-summary-copy"><span className="detail-label">AGENT STATUS</span><span className={`agent-state ${agent.status.toLowerCase()}`}><i />{agent.status}</span></div>
        <div className="details-summary-copy"><span className="detail-label">AGENT TYPE</span><strong>{agent.type}</strong></div>
        <div className="details-summary-copy"><span className="detail-label">MODEL</span><strong>{agent.model}</strong></div>
      </section>

      <section className="details-panel">
        <div className="details-panel-heading"><div><h2>Agent information</h2><p>Basic information for this demo agent.</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
        <div className="details-info-grid">
          <div className="detail-field"><span className="detail-label">NAME</span><strong>{agent.name}</strong></div>
          <div className="detail-field"><span className="detail-label">DESCRIPTION</span><strong>{agent.description}</strong></div>
          <div className="detail-field"><span className="detail-label">CREATED</span><strong>{agent.created}</strong></div>
          <div className="detail-field"><span className="detail-label">LAST UPDATED</span><strong>{agent.updated}</strong></div>
        </div>
      </section>

      <section className="details-panel configuration-panel">
        <div className="details-panel-heading"><div><h2>Configuration</h2><p>Placeholder settings for demonstration purposes.</p></div><span className="demo-badge panel-demo-badge">Demo Data</span></div>
        <div className="settings-list">
          <div className="setting-row"><div><strong>Temperature</strong><span>Controls how creative the agent’s responses are.</span></div><code>0.4</code></div>
          <div className="setting-row"><div><strong>Maximum response length</strong><span>Maximum generated tokens per response.</span></div><code>2,048 tokens</code></div>
          <div className="setting-row"><div><strong>Memory</strong><span>Retain context between conversations.</span></div><code>Enabled</code></div>
        </div>
      </section>
    </>
  )
}

function App() {
  const [activePage, setActivePage] = useState<Page>('Dashboard')
  const [agentSearch, setAgentSearch] = useState('')
  const [workflowSearch, setWorkflowSearch] = useState('')
  const [editorWorkflowName, setEditorWorkflowName] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<DemoAgent | null>(null)
  const isDashboard = activePage === 'Dashboard'
  const selectedPage = activePage === 'Agents' || activePage === 'Workflows' ? pageDetails[activePage] : null
  const filteredAgents = demoAgents.filter((agent) => agent.name.toLowerCase().includes(agentSearch.trim().toLowerCase()))
  const filteredWorkflows = demoWorkflows.filter((workflow) => workflow.name.toLowerCase().includes(workflowSearch.trim().toLowerCase()))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => { setSelectedAgent(null); setEditorWorkflowName(null); setActivePage('Dashboard') }} aria-label="Nexus home">
          <span className="brand-mark">✳</span>
          <span>Nexus<span className="brand-light"> AI</span></span>
        </button>

        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item${activePage === item.label ? ' active' : ''}`}
              type="button"
              onClick={() => { setSelectedAgent(null); setEditorWorkflowName(null); setActivePage(item.label) }}
              key={item.label}
              aria-current={activePage === item.label ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.label === 'Agents' && <span className="nav-count">24</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="plan-card">
            <span className="plan-icon">✦</span>
            <div><strong>Pro plan</strong><span>12 of 20 seats used</span></div>
            <span className="plan-arrow">↗</span>
          </div>
          <div className="profile-button">
            <span className="avatar">AM</span>
            <span className="profile-copy"><strong>Alex Morgan</strong><span>Admin</span></span>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

        <main className="main-content" id={activePage.toLowerCase()}>
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{selectedAgent ? `${activePage} / Agent Details` : editorWorkflowName ? 'Workflows / Editor' : activePage}</strong></div>
          <div className="topbar-actions">
            <span className="live-indicator"><i /> All systems operational</span>
            <span className="icon-button notification" aria-hidden="true">♧<i /></span>
            <span className="top-avatar">AM</span>
          </div>
        </header>

        <div className="dashboard-content">
          {isDashboard ? <>
          <section className="page-heading">
            <div>
              <p className="eyebrow">TUESDAY, NOVEMBER 11, 2026</p>
              <div className="heading-title-row"><h1>Dashboard</h1><span className="demo-badge">Demo Data</span></div>
              <p className="heading-subtitle">Here’s what’s happening with your AI agents today.</p>
            </div>
            <button className="primary-button" type="button"><span>＋</span> Create agent</button>
          </section>

          <section className="stats-grid" aria-label="Platform statistics">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className="stat-topline"><span>{stat.label}</span><span className={`stat-icon ${stat.tone}`} aria-hidden="true">{stat.icon}</span></div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-change"><span className="change-arrow">↗</span>{stat.change}</div>
              </article>
            ))}
          </section>

          <section className="executions-panel">
            <div className="panel-header">
              <div><h2>Recent Executions</h2><p>A real-time view of your agents’ activity.</p></div>
              <button className="text-button" type="button" onClick={() => setActivePage('Monitoring')}>View all executions <span>→</span></button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>AGENT</th><th>TASK</th><th>STARTED</th><th>DURATION</th><th>STATUS</th></tr></thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={`${execution.name}-${execution.time}`}>
                      <td><div className="agent-cell"><span className={`agent-avatar ${execution.color}`}>{execution.initials}</span><strong>{execution.name}</strong></div></td>
                      <td className="task-cell">{execution.task}</td>
                      <td className="muted-cell">{execution.time}</td>
                      <td className="duration-cell">{execution.duration}</td>
                      <td><span className={`status-badge ${execution.status.toLowerCase()}`}><i />{execution.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <strong>5</strong> sample rows</span><div className="pagination"><button type="button" disabled aria-label="Previous page">←</button><span>Demo</span><button type="button" disabled aria-label="Next page">→</button></div></div>
          </section>
          </> : activePage === 'Workflows' && editorWorkflowName ? <WorkflowEditor workflowName={editorWorkflowName} onBack={() => setEditorWorkflowName(null)} /> : activePage === 'Analytics' ? <AnalyticsPage /> : activePage === 'Approvals' ? <ApprovalsPage /> : activePage === 'Errors' ? <ErrorsPage /> : activePage === 'Security' ? <SecurityPage /> : activePage === 'Performance & Costs' ? <PerformanceCostsPage /> : activePage === 'Logs' ? <LogsPage /> : activePage === 'Monitoring' ? <MonitoringPage /> : selectedPage && <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">WORKSPACE</p>
                <div className="heading-title-row"><h1>{activePage}</h1><span className="demo-badge">Demo Data</span></div>
                <p className="heading-subtitle">{selectedPage.subtitle}</p>
              </div>
              <button className="primary-button" type="button" onClick={activePage === 'Workflows' ? () => setEditorWorkflowName('Untitled Workflow') : undefined}><span>＋</span> {activePage === 'Agents' ? 'Create Agent' : activePage === 'Workflows' ? 'Create Workflow' : 'View alerts'}</button>
            </section>
            <div className="demo-note"><span className="demo-note-dot" /> Sample {activePage.toLowerCase()} data for preview. No live backend is connected.</div>
            {activePage === 'Agents' && selectedAgent ? <AgentDetails agent={selectedAgent} onBack={() => setSelectedAgent(null)} /> : activePage === 'Agents' ? <>
              <label className="agent-search">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} placeholder="Search agents by name..." aria-label="Search agents by name" />
              </label>
              {filteredAgents.length > 0 ? <section className="agent-grid" aria-label="Demo agents">
                {filteredAgents.map((agent) => (
                  <article className="agent-card" key={agent.name}>
                    <div className="agent-card-top">
                      <span className={`agent-avatar agent-card-avatar ${agent.color}`}>{agent.initials}</span>
                      <span className={`agent-state ${agent.status.toLowerCase()}`}><i />{agent.status}</span>
                    </div>
                    <h2>{agent.name}</h2>
                    <p className="agent-description">{agent.description}</p>
                    <div className="agent-card-bottom">
                      <span>{agent.updated}</span>
                      <button className="manage-button" type="button" onClick={() => setSelectedAgent(agent)} aria-label={`View or manage ${agent.name}`}>View / Manage <span>→</span></button>
                    </div>
                  </article>
                ))}
              </section> : <div className="agent-empty">No demo agents match “{agentSearch}”. Try another name.</div>}
            </> : activePage === 'Workflows' ? <>
              <label className="agent-search">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={workflowSearch} onChange={(event) => setWorkflowSearch(event.target.value)} placeholder="Search workflows by name..." aria-label="Search workflows by name" />
              </label>
              {filteredWorkflows.length > 0 ? <section className="agent-grid workflow-grid" aria-label="Demo workflows">
                {filteredWorkflows.map((workflow) => (
                  <article className="agent-card workflow-card" key={workflow.name}>
                    <div className="agent-card-top">
                      <span className={`agent-avatar agent-card-avatar ${workflow.color}`}>{workflow.initials}</span>
                      <span className={`workflow-state ${workflow.status.toLowerCase()}`}><i />{workflow.status}</span>
                    </div>
                    <h2>{workflow.name}</h2>
                    <p className="agent-description">{workflow.description}</p>
                    <div className="workflow-meta"><span><b>{workflow.steps}</b> steps</span><span>Updated {workflow.updated}</span></div>
                    <div className="agent-card-bottom">
                      <span>Demo workflow</span>
                      <button className="manage-button" type="button" onClick={() => setEditorWorkflowName(workflow.name)} aria-label={`Open editor for ${workflow.name}`}>Open Editor <span>→</span></button>
                    </div>
                  </article>
                ))}
              </section> : <div className="agent-empty">No demo workflows match “{workflowSearch}”. Try another name.</div>}
            </> : null}
          </>}
          <footer className="dashboard-footer"><span>© 2026 Nexus AI</span><span>Built for teams who build with AI <b>✦</b></span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
