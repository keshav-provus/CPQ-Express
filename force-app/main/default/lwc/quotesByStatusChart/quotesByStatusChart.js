import { LightningElement, wire, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import chartjs from '@salesforce/resourceUrl/chartjs';
import getQuotesByStatus from '@salesforce/apex/DashboardController.getQuotesByStatus';

const STATUS_COLORS = {
    'Draft': '#818cf8',
    'Submitted': '#fbbf24',
    'Approved': '#34d399',
    'Rejected': '#f87171'
};

const STATUS_BORDERS = {
    'Draft': '#6366f1',
    'Submitted': '#f59e0b',
    'Approved': '#10b981',
    'Rejected': '#ef4444'
};

export default class QuotesByStatusChart extends LightningElement {
    @track isLoading = true;
    @track hasNoData = false;
    chartData = [];
    chartJsInitialized = false;
    chart;

    @api 
    set dashboardData(value) {
        if (value) {
            this.chartData = value;
            this.hasNoData = value.length === 0;
            if (this.chartJsInitialized && !this.hasNoData) {
                this.renderChart();
            }
            this.isLoading = false;
        }
    }
    get dashboardData() {
        return this.chartData;
    }

    renderedCallback() {
        if (this.chartJsInitialized) {
            return;
        }

        loadScript(this, chartjs)
            .then(() => {
                this.chartJsInitialized = true;
                if (this.chartData.length > 0) {
                    this.renderChart();
                }
            })
            .catch(error => {
                console.error('Error loading Chart.js:', error);
            });
    }

    renderChart() {
        const canvas = this.template.querySelector('.chart-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const labels = this.chartData.map(d => d.status);
        const values = this.chartData.map(d => d.count);
        const bgColors = labels.map(s => STATUS_COLORS[s] || '#94a3b8');
        const borderColors = labels.map(s => STATUS_BORDERS[s] || '#64748b');

        this.chart = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 12,
                            font: { size: 12, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 800
                }
            }
        });
    }

    disconnectedCallback() {
        if (this.chart) {
            this.chart.destroy();
        }
    }
}
