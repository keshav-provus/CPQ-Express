import {  LightningElement, api, track, wire  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqManagerKPIs extends LightningElement {
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

    @api kpiData = {};
    @track currencyCode = 'USD';

        formatCurrencyValue(value) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(value);
    }

    formatCurrencyCompact(value) {
        if (value >= 1000000) {
            const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d,.]/g, '').trim();
            return sym + (value / 1000000).toFixed(1) + 'M';
        }
        if (value >= 1000) {
            const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d,.]/g, '').trim();
            return sym + (value / 1000).toFixed(0) + 'k';
        }
        return this.formatCurrencyValue(value);
    }

    get formattedRevenue() {
        const rev = this.kpiData?.totalRevenue || 0;
        return this.formatCurrencyCompact(rev);
    }

    get revenueTrend() { return this.kpiData?.revenueTrend || 12; }
    get activeQuotes() { return this.kpiData?.activeQuotes || 0; }
    get velocityDays() { return this.kpiData?.velocityDays || '4.2'; }

    get approvalRate() {
        const total = this.kpiData?.totalQuotes || 1;
        const approved = this.kpiData?.approvedQuotes || 0;
        return total > 0 ? Math.round((approved / total) * 100) : 0;
    }

    get approvalProgressStyle() {
        return `width: ${this.approvalRate}%`;
    }

    get formattedAvgValue() {
        const val = this.kpiData?.avgQuoteValue || 0;
        return this.formatCurrencyCompact(val);
    }

    get avgTrend() { return this.kpiData?.avgTrend || 6; }

    get formattedWinRate() {
        return this.kpiData?.winRate || 84;
    }

    get targetWinRate() { return 80; }
    get winRateDelta() { return this.kpiData?.winRateDelta || 8; }

    get waffleBlocks() {
        const winRate = this.formattedWinRate;
        const filled = Math.round(winRate / 100 * 12);
        const blocks = [];
        for (let i = 0; i < 12; i++) {
            blocks.push({
                key: 'w' + i,
                className: i < filled ? 'waffle-block waffle-filled' : 'waffle-block waffle-empty'
            });
        }
        return blocks;
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