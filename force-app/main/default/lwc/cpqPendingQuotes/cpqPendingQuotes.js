import { LightningElement, wire, track } from 'lwc';
import getQuotesNeedingApproval from '@salesforce/apex/DashboardController.getQuotesNeedingApproval';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqPendingQuotes extends LightningElement {
    @track currencyCode = 'USD';

    @wire(getDefaultCurrency)
    wiredDefaultCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @track quotes;
    wiredQuotesResult;

    @wire(getQuotesNeedingApproval)
    wiredQuotes(result) {
        this.wiredQuotesResult = result;
        if (result.data) {
            this.quotes = result.data;
        } else if (result.error) {
            console.error('Error fetching pending quotes:', result.error);
        }
    }

    get hasQuotes() {
        return this.quotes && this.quotes.length > 0;
    }

    get formattedQuotes() {
        if (!this.quotes) return [];
        return this.quotes.map(quote => ({
            ...quote,
            AccountName: quote.Account__r ? quote.Account__r.Name : 'No Account',
            formattedAmount: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: this.currencyCode,
                maximumFractionDigits: 0
            }).format(quote.Total_Amount__c || 0),
            formattedDate: new Date(quote.CreatedDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short'
            })
        }));
    }

    handleRefresh() {
        refreshApex(this.wiredQuotesResult);
    }

    handleApprove(event) {
        const quoteId = event.target.dataset.id;
        this.showToast('Success', 'Quote approved successfully', 'success');
        // In a real app, this would call an Apex method to update Status__c = 'Approved'
        this.handleRefresh();
    }

    handleReject(event) {
        const quoteId = event.target.dataset.id;
        this.showToast('Info', 'Revision requested for quote', 'info');
        // In a real app, this would call an Apex method to update Status__c = 'Rejected'
        this.handleRefresh();
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}