import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';

export default class CpqQuoteActions extends LightningElement {
    @api recordId;

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
