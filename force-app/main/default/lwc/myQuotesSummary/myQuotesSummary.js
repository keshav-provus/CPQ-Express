import { LightningElement, wire, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import chartjs from '@salesforce/resourceUrl/chartjs';
import getMyQuoteStats from '@salesforce/apex/DashboardController.getMyQuoteStats';

const STATUS_COLORS = ['#818cf8', '#fbbf24', '#34d399', '#f87171'];

export default class MyQuotesSummary extends LightningElement {
    @track draftCount = 0;
    @track submittedCount = 0;
    @track approvedCount = 0;
    @track rejectedCount = 0;
    @track isLoading = true;
    @track isCreateModalOpen = false;

    wiredStatusResult;

    openCreateModal() {
        this.isCreateModalOpen = true;
    }

    closeCreateModal() {
        this.isCreateModalOpen = false;
    }

    chartJsInitialized = false;
    chart;

    @wire(getMyQuoteStats)
    wiredStats({ data, error }) {
        this.isLoading = false;
        if (data) {
            this.draftCount = data.Draft || 0;
            this.submittedCount = data.Submitted || 0;
            this.approvedCount = data.Approved || 0;
            this.rejectedCount = data.Rejected || 0;
            if (this.chartJsInitialized) {
                this.renderChart();
            }
        } else if (error) {
            console.error('Error loading quote stats:', error);
        }
    }

    renderedCallback() {
        if (this.chartJsInitialized) return;
        loadScript(this, chartjs)
            .then(() => {
                this.chartJsInitialized = true;
                if (!this.isLoading) {
                    this.renderChart();
                }
            })
            .catch(error => console.error('Error loading Chart.js:', error));
    }

    renderChart() {
        const canvas = this.template.querySelector('.donut-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (this.chart) this.chart.destroy();

        const values = [this.draftCount, this.submittedCount, this.approvedCount, this.rejectedCount];
        const total = values.reduce((s, v) => s + v, 0);

        this.chart = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Draft', 'Submitted', 'Approved', 'Rejected'],
                datasets: [{
                    data: total > 0 ? values : [1],
                    backgroundColor: total > 0 ? STATUS_COLORS : ['#e2e8f0'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 }
                    }
                },
                animation: { animateRotate: true, duration: 800 }
            }
        });
    }

    disconnectedCallback() {
        if (this.chart) this.chart.destroy();
    }
}
