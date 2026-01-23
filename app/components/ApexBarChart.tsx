'use client'

import dynamic from 'next/dynamic'

type ApexBarChartProps = {
  title: string
  labels: string[]
  values: number[]
  height?: number
}

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

export function ApexBarChart({ title, labels, values, height = 260 }: ApexBarChartProps) {
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

  // Guard against mismatched/empty data that can break ApexCharts
  if (!safeLabels.length || !safeValues.length) {
    return (
      <div className="panel-card rounded-2xl bg-white p-4 shadow-soft">
        <div className="mb-3 text-center text-sm font-semibold text-ink">{safeTitle}</div>
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-sm text-muted">No data available</p>
        </div>
      </div>
    )
  }

  const series = [
    {
      name: safeTitle,
      data: safeValues
    }
  ]

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar' as const,
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 900
      }
    },
    plotOptions: {
      bar: {
        borderRadius: 10,
        columnWidth: '50%',
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      show: false
    },
    xaxis: {
      categories: safeLabels,
      labels: {
        style: { colors: '#6b7280', fontFamily: 'Mulish, sans-serif' }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#6b7280', fontFamily: 'Mulish, sans-serif' }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.35,
        gradientToColors: ['#10b981'],
        stops: [0, 100]
      }
    },
    grid: {
      borderColor: 'rgba(124, 58, 237, 0.12)'
    },
    theme: {
      mode: 'light'
    }
  }

  return (
    <div className="panel-card rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 text-center text-sm font-semibold text-ink">{title}</div>
      <ReactApexChart options={options} series={series} type="bar" height={height} />
    </div>
  )
}
