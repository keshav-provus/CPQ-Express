import { LightningElement, track, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import getWeeklyPipeline from '@salesforce/apex/DashboardController.getWeeklyPipeline';
import chartjs from '@salesforce/resourceUrl/chartjs';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqWeeklyPipelineChart extends LightningElement {
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @track
    chartData = [];
    chartLoaded = false;
    chartInstance;

    @wire(getWeeklyPipeline)
    wiredPipeline({ error, data }) {
        if (data) {
            this.chartData = data;
            this.initializeChart();
        } else if (error) {
            console.error('Error fetching weekly pipeline:', error);
        }
    }

    renderedCallback() {
        if (this.chartLoaded) return;
        
        loadScript(this, chartjs)
            .then(() => {
                this.chartLoaded = true;
                this.initializeChart();
            })
            .catch(error => {
                console.error('Error loading ChartJS', error);
            });
    }

    initializeChart() {
        if (!this.chartLoaded || !this.chartData || this.chartData.length === 0 || this.chartInstance) {
            return;
        }

        const ctx = this.refs.chartCanvas.getContext('2d');
        
        const labels = this.chartData.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        
        const data = this.chartData.map(item => item.amount);

        // Make sure Chart is available natively from the static resource
        this.chartInstance = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pipeline Value',
                    data: data,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4,
                    barPercentage: 0.5,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#111827',
                        titleFont: { size: 13, family: 'Inter' },
                        bodyFont: { size: 14, family: 'Inter', weight: 'bold' },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: { family: 'Inter' }
                        }
                    },
                    y: {
                        grid: {
                            color: '#f3f4f6',
                            drawBorder: false,
                        },
                        ticks: {
                            color: '#6b7280',
                            font: { family: 'Inter' },
                            callback: function(value) {
                                if (value >= 1000) {
                                    return '$' + value / 1000 + 'k';
                                }
                                return '$' + value;
                            }
                        }
                    }
                }
            }
        });
    }
}