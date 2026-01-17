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
  const series = [
    {
      name: title,
      data: values
    }
  ]

  const options = {
    chart: {
      type: 'bar',
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
      categories: labels,
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
    <div className="rounded-2xl bg-white p-4 shadow-soft">
      <div className="mb-3 text-center text-sm font-semibold text-ink">{title}</div>
      <ReactApexChart options={options} series={series} type="bar" height={height} />
    </div>
  )
}
