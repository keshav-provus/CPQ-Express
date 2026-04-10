import { LightningElement, api, wire, track } from 'lwc';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqManagerKPIs extends LightningElement {
    @track currencyCode = 'USD';
    @track _kpiData = {};

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @api
    set kpiData(value) {
        if (value) {
            this._kpiData = value;
        }
    }
    get kpiData() {
        return this._kpiData;
    }

    get formattedRevenue() {
        return this.formatCurrency(this._kpiData.totalRevenue || 0);
    }

    get formattedMargin() {
        const revenue = this._kpiData.totalRevenue || 0;
        const marginPct = this._kpiData.avgMargin || 0;
        const margin = revenue * (marginPct / 100);
        return this.formatCurrency(margin);
    }

    get activeQuotes() {
        return this._kpiData.activeQuotes || 0;
    }

    get formattedAvgQuote() {
        return this.formatCurrency(this._kpiData.avgQuoteValue || 0);
    }

    get winRate() {
        return this._kpiData.winRate || 0;
    }

    formatCurrency(value) {
        if (value >= 1000000) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 1
            }).format(value / 1000000) + 'M';
        }
        if (value >= 1000) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 1
            }).format(value / 1000) + 'K';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: this.currencyCode,
            maximumFractionDigits: 0
        }).format(value);
    }
}