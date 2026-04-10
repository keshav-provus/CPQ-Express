import {  LightningElement, api, track, wire  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class TeamQuotesPipeline extends LightningElement {
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

    @track totalPipeline = 0;
    @track avgMargin = 0;
    @track pendingApproval = 0;
    @track thisMonthQuotes = 0;
    @track isLoading = true;
    @track currencyCode = 'USD';

        @api 
    set dashboardData(value) {
        if (value) {
            this.totalPipeline = value.totalPipeline || 0;
            this.avgMargin = value.avgMargin || 0;
            this.pendingApproval = value.pendingApproval || 0;
            this.thisMonthQuotes = value.thisMonthQuotes || 0;
            this.isLoading = false;
        }
    }
    get dashboardData() {
        return {
            totalPipeline: this.totalPipeline,
            avgMargin: this.avgMargin,
            pendingApproval: this.pendingApproval,
            thisMonthQuotes: this.thisMonthQuotes
        };
    }

    get formattedPipeline() {
        const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d,.]/g, '').trim();
        if (this.totalPipeline >= 1000000) {
            return sym + (this.totalPipeline / 1000000).toFixed(1) + 'M';
        }
        if (this.totalPipeline >= 1000) {
            return sym + (this.totalPipeline / 1000).toFixed(1) + 'K';
        }
        return sym + this.totalPipeline.toFixed(0);
    }

    get formattedMargin() {
        return this.avgMargin.toFixed(1);
    }
}
