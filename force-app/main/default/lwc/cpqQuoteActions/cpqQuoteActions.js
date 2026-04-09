import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { notifyRecordUpdateAvailable, getRecord, getFieldValue } from 'lightning/uiRecordApi';
import STATUS_FIELD from '@salesforce/schema/Quote__c.Status__c';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from '@salesforce/apex/QuoteController.rejectQuote';

export default class CpqQuoteActions extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [STATUS_FIELD] })
    quote;

    get isDraft() {
        const val = getFieldValue(this.quote.data, STATUS_FIELD);
        return val === 'Draft' || !val;
    }

    get isPending() {
        return getFieldValue(this.quote.data, STATUS_FIELD) === 'Pending Approval';
    }

    async handleSubmit() {
        try {
            await submitForApproval({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Quote submitted for approval.',
                    variant: 'success'
                })
            );
            // Refresh the record data in the UI
            await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error submitting quote',
                    message: error.body ? error.body.message : 'Unknown error',
                    variant: 'error'
                })
            );
        }
    }

    async handleApprove() {
        try {
            await approveQuote({ quoteId: this.recordId });
            this.dispatchEvent(new ShowToastEvent({ title: 'Success', message: 'Quote approved.', variant: 'success' }));
            await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Error approving', message: error.body ? error.body.message : 'Unknown error', variant: 'error' }));
        }
    }

    async handleReject() {
        try {
            await rejectQuote({ quoteId: this.recordId });
            this.dispatchEvent(new ShowToastEvent({ title: 'Success', message: 'Quote rejected.', variant: 'success' }));
            await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({ title: 'Error rejecting', message: error.body ? error.body.message : 'Unknown error', variant: 'error' }));
        }
    }

    handlePDF() {
        this.dispatchEvent(
            new showToastEvent({
                title: 'Generating PDF',
                message: 'Your quote document is being prepared. View it in the Files related list.',
                variant: 'info'
            })
        );
    }
}
