import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getQuotesNeedingApproval from '@salesforce/apex/DashboardController.getQuotesNeedingApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqPendingQuotes extends NavigationMixin(LightningElement) {
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

    get totalLabel() {
        const count = this.quotes ? this.quotes.length : 0;
        return count + ' Total';
    }

    get formattedQuotes() {
        if (!this.quotes) return [];
        return this.quotes.map((quote, index) => {
            const isUrgent = (quote.Total_Amount__c || 0) > 100000;
            const isReview = quote.Status__c === 'Submitted' && !isUrgent;
            let urgencyLabel = 'Standard';
            let urgencyClass = 'urgency-badge standard';

            if (isUrgent) {
                urgencyLabel = 'Urgent';
                urgencyClass = 'urgency-badge urgent';
            } else if (isReview && index % 3 === 0) {
                urgencyLabel = 'Review';
                urgencyClass = 'urgency-badge review';
            }

            return {
                ...quote,
                AccountName: quote.Account__r ? quote.Account__r.Name : 'No Account',
                formattedAmount: new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: this.currencyCode,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(quote.Total_Amount__c || 0),
                urgencyLabel,
                urgencyClass
            };
        });
    }

    handleNavigateToQuote(event) {
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
        if (!this.quotes || this.quotes.length === 0) return;

        let successCount = 0;
        let failCount = 0;

        for (const quote of this.quotes) {
            try {
                await approveQuote({ quoteId: quote.Id });
                successCount++;
            } catch (error) {
                failCount++;
                console.error('Failed to approve quote ' + quote.Name, error);
            }
        }

        if (successCount > 0) {
            this.showToast('Success', successCount + ' quote(s) approved successfully', 'success');
        }
        if (failCount > 0) {
            this.showToast('Warning', failCount + ' quote(s) failed to approve', 'warning');
        }

        refreshApex(this.wiredQuotesResult);
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