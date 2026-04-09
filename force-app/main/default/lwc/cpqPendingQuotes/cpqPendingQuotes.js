import { LightningElement, wire, track } from 'lwc';
import getQuotesNeedingApproval from '@salesforce/apex/DashboardController.getQuotesNeedingApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from '@salesforce/apex/QuoteController.rejectQuote';
import recallApproval from '@salesforce/apex/QuoteController.recallApproval';
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

    async handleApprove(event) {
        const quoteId = event.currentTarget.dataset.id;
        try {
            await approveQuote({ quoteId });
            this.showToast('Success', 'Quote approved successfully', 'success');
            this.handleRefresh();
        } catch (error) {
            const msg = error.body?.message || 'Failed to approve quote';
            this.showToast('Error', msg, 'error');
        }
    }

    async handleReject(event) {
        const quoteId = event.currentTarget.dataset.id;
        try {
            await rejectQuote({ quoteId });
            this.showToast('Info', 'Quote rejected', 'info');
            this.handleRefresh();
        } catch (error) {
            const msg = error.body?.message || 'Failed to reject quote';
            this.showToast('Error', msg, 'error');
        }
    }

    async handleRecall(event) {
        const quoteId = event.currentTarget.dataset.id;
        try {
            await recallApproval({ quoteId });
            this.showToast('Info', 'Quote recalled to draft', 'info');
            this.handleRefresh();
        } catch (error) {
            const msg = error.body?.message || 'Failed to recall quote';
            this.showToast('Error', msg, 'error');
        }
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