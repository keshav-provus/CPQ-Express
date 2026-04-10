import {  LightningElement, track, wire  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import { loadScript } from 'lightning/platformResourceLoader';
import getWeeklyPipeline from '@salesforce/apex/DashboardController.getWeeklyPipeline';
import chartjs from '@salesforce/resourceUrl/chartjs';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqWeeklyPipelineChart extends LightningElement {
    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                CURRENCY_CHANGE_CHANNEL,
                (message) => {
                    this.handleCurrencyChange(message);
                }
            );
        }

        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track currencyCode = 'USD';

        @track chartData = [];
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
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        const data = this.chartData.map(item => item.amount);

        // Purple gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(124, 92, 252, 0.25)');
        gradient.addColorStop(1, 'rgba(124, 92, 252, 0.02)');

        const currCode = this.currencyCode;

        const currSymbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: currCode, maximumFractionDigits: 0 }).format(0).replace(/[\d.,\s]/g, '');

        this.chartInstance = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: data,
                    backgroundColor: 'rgba(124, 92, 252, 0.85)',
                    hoverBackgroundColor: 'rgba(124, 92, 252, 1)',
                    borderRadius: 6,
                    barPercentage: 0.55,
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
                        backgroundColor: '#1a1a2e',
                        titleFont: { size: 12, family: 'Inter, sans-serif', weight: '500' },
                        bodyFont: { size: 14, family: 'Inter, sans-serif', weight: '700' },
                        padding: { top: 10, right: 14, bottom: 10, left: 14 },
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                if (context.parsed.y !== null) {
                                    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currCode, maximumFractionDigits: 0 }).format(context.parsed.y);
                                }
                                return '';
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
                            color: '#9ca3af',
                            font: { family: 'Inter, sans-serif', size: 11 }
                        }
                    },
                    y: {
                        grid: {
                            color: '#f3f4f6',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: { family: 'Inter, sans-serif', size: 11 },
                            callback: function(value) {
                                if (value >= 1000000) return currSymbol + (value / 1000000).toFixed(1) + 'M';
                                if (value >= 1000) return currSymbol + (value / 1000).toFixed(0) + 'k';
                                return currSymbol + value;
                            }
                        }
                    }
                }
            }
        });
    }

    disconnectedCallback() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }

    handleCurrencyChange(message) {
        if(message && message.currencyCode) {
            this.currencyCode = message.currencyCode;
            if(this.refreshData) {
                this.refreshData();
            }
        }
    }

}