'use client'

import dynamic from 'next/dynamic'

type ApexDonutChartProps = {
  title: string
  labels: string[]
  values: number[]
  height?: number
}

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

export function ApexDonutChart({
  title,
  labels,
  values,
  height = 260
}: ApexDonutChartProps) {
  const safeTitle = String(title ?? '')
  const rawLabels = Array.isArray(labels) ? labels : []
  const rawValues = Array.isArray(values) ? values : []
  const paired = rawLabels.map((label, index) => ({
    label: String(label ?? ''),
    value: Number(rawValues[index])
  }))
  const cleaned = paired
    .filter((item) => item.label.trim().length > 0)
    .map((item) => ({
      label: item.label,
      value: Number.isFinite(item.value) ? item.value : 0
    }))
  const safeLabels = cleaned.map((item) => item.label)
  const safeValues = cleaned.map((item) => item.value)

  if (!safeLabels.length || !safeValues.length) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-soft">
        <div className="mb-3 text-center text-sm font-semibold text-ink">{safeTitle}</div>
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-sm text-muted">No data available</p>
        </div>
      </div>
    )
  }

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 900
      }
    },
    labels: safeLabels,
    legend: {
      position: 'bottom',
      fontSize: '12px',
      fontFamily: 'Mulish, sans-serif',
      labels: { colors: '#6b7280' }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      width: 2,
      colors: ['#ffffff']
    },
    colors: ['#f59e0b', '#10b981', '#6366f1', '#ec4899'],
    tooltip: {
      y: {
        formatter: (value) => value.toLocaleString('en-US')
      }
    }
  }

  return (
    <div className="panel-card rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 text-center text-sm font-semibold text-ink">{safeTitle}</div>
      <ReactApexChart options={options} series={safeValues} type="donut" height={height} />
    </div>
  )
}
