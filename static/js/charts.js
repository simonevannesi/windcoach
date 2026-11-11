// WindCoach Pro - Dual-axis Strip Chart (TWD & TWS)

class TacticalCharts {
    constructor() {
        this.chart = null;
        this.initChart();
    }

    initChart() {
        const ctx = document.getElementById('chart-coach');
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'TWD Direzione (°)',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.08)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.2,
                        yAxisID: 'yTwd',
                    },
                    {
                        label: 'TWD Media (°)',
                        data: [],
                        borderColor: '#38bdf8',
                        borderWidth: 1.5,
                        borderDash: [5, 4],
                        pointRadius: 0,
                        fill: false,
                        yAxisID: 'yTwd',
                    },
                    {
                        label: 'TWS Intensità (kts)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.25,
                        fill: true,
                        yAxisID: 'yTws',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 350 },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#38bdf8',
                        bodyColor: '#f1f5f9',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 8
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(51, 65, 85, 0.25)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            maxTicksLimit: 7
                        }
                    },
                    yTwd: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: 'rgba(6, 182, 212, 0.15)' },
                        ticks: {
                            color: '#22d3ee',
                            font: { size: 9 },
                            callback: (v) => `${v}°`
                        }
                    },
                    yTws: {
                        type: 'linear',
                        position: 'right',
                        suggestedMin: 0,
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: '#fbbf24',
                            font: { size: 9 },
                            callback: (v) => `${v} kts`
                        }
                    }
                }
            }
        });
    }

    update(d) {
        if (!this.chart || !d || !d.has_data || !d.chart_data) return;

        const cd = d.chart_data;
        const meanTwd = d.mean_twd || 0;

        this.chart.data.labels = cd.labels;
        this.chart.data.datasets[0].data = cd.twd;
        this.chart.data.datasets[1].data = new Array(cd.labels.length).fill(meanTwd);
        this.chart.data.datasets[2].data = cd.tws;

        this.chart.update('none');
    }
}
