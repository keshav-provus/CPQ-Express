import {  LightningElement, wire, track  } from 'lwc';
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';

import { NavigationMixin } from 'lightning/navigation';
import getPendingActionItems from '@salesforce/apex/DashboardController.getPendingActionItems';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqPendingQuotes extends NavigationMixin(LightningElement) {
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

    @track quotes = [];
    @track currencyCode = 'USD';

        @wire(getPendingActionItems)
    wiredQuotes({ data, error }) {
        if (data) {
            const colors = ['bg-blue-100', 'bg-green-100', 'bg-purple-100', 'bg-orange-100'];
            this.quotes = data.map((q, i) => {
                const amount = q.Total_Amount__c || 0;
                const name = q.Name || '';
                const acctName = q.Account__r ? q.Account__r.Name : '';
                const ownerName = q.Owner ? q.Owner.Name : 'Unknown';
                const created = q.CreatedDate ? new Date(q.CreatedDate) : new Date();
                const hoursAgo = Math.round((Date.now() - created) / 3600000);
                const sym = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(0).replace(/[\d,.]/g, '').trim();

                return {
                    ...q,
                    displayName: acctName ? `${acctName} - ${name}` : name,
                    ownerName,
                    timeAgo: hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.round(hoursAgo / 24)}d ago`,
                    formattedAmount: amount >= 1000000
                        ? sym + (amount / 1000000).toFixed(2) + 'M'
                        : amount >= 1000
                            ? sym + (amount / 1000).toFixed(0) + 'k'
                            : sym + amount.toFixed(0),
                    initials: ownerName.split(' ').map(n => n[0]).join('').substring(0, 2),
                    avatarColor: colors[i % colors.length],
                    progressStyle: `width: ${Math.min(25 + (i * 20), 75)}%`,
                    statusLabel: `Step ${Math.min(i + 1, 3)}/${Math.max(3, i + 2)}`
                };
            });
        } else if (error) {
            console.error('Error loading pending quotes:', error);
        }
    }

    get displayQuotes() {
        return this.quotes.slice(0, 4);
    }

    get hasQuotes() {
        return this.quotes.length > 0;
    }

    handleQuoteClick(event) {
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

    async handleBulkApprove() {
        for (const q of this.quotes) {
            try {
                await submitForApproval({ quoteId: q.Id });
            } catch (e) {
                console.error('Error approving quote:', e);
            }
        }
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