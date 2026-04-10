import {  LightningElement, api, track, wire  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqQuotePricingAnalytics extends LightningElement {
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

    @api recordId;
    @api competitiveMatch = 92;
    @track currencyCode = 'USD';

        get historicalAverage() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(39400);
    }
}
