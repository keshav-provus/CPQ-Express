import {  LightningElement, wire, track  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import getMyTopTransactions from '@salesforce/apex/DashboardController.getMyTopTransactions';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqMyTopTransactions extends LightningElement {
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

        @track transactions;

    @wire(getMyTopTransactions)
    wiredTransactions({ error, data }) {
        if (data) {
            this.transactions = data;
        } else if (error) {
            console.error('Error fetching top transactions', error);
        }
    }

    get formattedTransactions() {
        if (!this.transactions) return [];
        return this.transactions.map(tx => ({
            ...tx,
            accountName: tx.Account__r ? tx.Account__r.Name : 'No Account',
            formattedDate: new Date(tx.CreatedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            formattedAmount: new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(tx.Total_Amount__c || 0)
        }));
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