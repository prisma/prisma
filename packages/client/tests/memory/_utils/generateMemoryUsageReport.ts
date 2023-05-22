import fs from 'fs/promises'

import type { TestResult } from './runMemoryTest'

export async function generateMemoryUsageReport(outputFile: string, results: TestResult[]) {
  await fs.writeFile(outputFile, getHtmlTemplate(results))
}

function getHtmlTemplate(results: TestResult[]) {
  const renderCalls = results
    .map((result) => {
      const name = result.testDir.testName
      const data = Array.from(result.heapUsageOverTime.entries())
      return `renderChart(${JSON.stringify({ name, data, hasLeak: result.hasLeak })})`
    })
    .join()
  return `
<!DOCTYPE html>
<html>
    <head>
        <title>Memory tests usage</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.0/dist/chart.min.js"></script>
        <style>
        body {
            margin: 0;
            padding: 0;
        }

        .chart {
            margin-bottom: 32px;
        }

        .chart-container {
            width: 800px;
            margin: 0 auto;
            max-width: 100%;
        }
        </style>
    </head>
    <body>
        <div class="chart-container"></div>
        <script type="module">
            import prettyBytes from 'https://cdn.jsdelivr.net/npm/pretty-bytes@6.0.0/index.js';

            const chartContainer = document.querySelector('.chart-container')

            function renderChart({ name, data, hasLeak }) {
                const canvas = document.createElement('canvas')
                canvas.classList.add('chart')
                chartContainer.appendChild(canvas)
                const ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        datasets: [
                            {
                                label: name + ' test heap usage',
                                data,
                                fill: false,
                                borderColor: hasLeak ? '#A33B36' : '#46A368',
                            },
                        ]
                    },
                    options: {
                        scales: {
                            x: {
                                type: 'linear',
                                title: {
                                    display: true,
                                    text: 'Iteration'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: (value) => prettyBytes(value)
                                }
                            },
                        },
                        elements: {
                            point: {
                                radius: 0
                            }
                        }
                    }
                })

            }

            ${renderCalls}
        </script>
    </body>
</html>
`
}
