import { LightningElement, api } from 'lwc';
import { showToastEvent } from 'lightning/platformShowToastEvent';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import submitQuote from '@salesforce/apex/QuoteController.submitQuote';

export default class CpqQuoteActions extends LightningElement {
    @api recordId;

    async handleSubmit() {
        try {
            await submitQuote({ quoteId: this.recordId });
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Success',
                    message: 'Quote submitted for approval.',
                    variant: 'success'
                })
            );
            // Refresh the record data in the UI
            await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
        } catch (error) {
            this.dispatchEvent(
                new showToastEvent({
                    title: 'Error submitting quote',
                    message: error.body ? error.body.message : 'Unknown error',
                    variant: 'error'
                })
            );
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
