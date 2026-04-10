import {  LightningElement, wire, track  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import getPendingActionItems from '@salesforce/apex/DashboardController.getPendingActionItems';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqActionItems extends NavigationMixin(LightningElement) {
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

        @track items;
    wiredItemsResult;

    @wire(getPendingActionItems)
    wiredItems(result) {
        this.wiredItemsResult = result;
        if (result.data) {
            this.items = result.data;
        } else if (result.error) {
            console.error('Error fetching action items:', result.error);
        }
    }

    get hasItems() {
        return this.items && this.items.length > 0;
    }

    get formattedItems() {
        if (!this.items) return [];
        return this.items.map(item => ({
            ...item,
            AccountName: item.Account__r ? item.Account__r.Name : 'No Account',
            formattedAmount: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 0
            }).format(item.Total_Amount__c || 0),
            formattedDate: new Date(item.CreatedDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short'
            }),
            statusClass: `status-badge status-${item.Status__c.toLowerCase().replace(/ /g, '-')}`
        }));
    }

    handleRefresh() {
        refreshApex(this.wiredItemsResult);
    }

    handleViewQuote(event) {
        const quoteId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: quoteId,
                objectApiName: 'Quote__c',
                actionName: 'view'
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