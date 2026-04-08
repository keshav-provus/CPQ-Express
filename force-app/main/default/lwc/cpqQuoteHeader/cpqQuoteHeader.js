import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';
import recallApproval from '@salesforce/apex/QuoteController.recallApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from '@salesforce/apex/QuoteController.rejectQuote';
import generateQuotePdf from '@salesforce/apex/QuoteController.generateQuotePdf';

export default class CpqQuoteHeader extends LightningElement {
    @api recordId;
    @api quoteData;

    get quoteName() {
        return this.quoteData?.Name || 'N/A';
    }

    get totalAmount() {
        return this.quoteData?.Total_Amount__c || 0;
    }

    get margin() {
        const pct = this.quoteData?.Margin_Percent__c;
        return pct != null ? (pct * 100).toFixed(2) : '0.00';
    }

    get marginAmount() {
        return this.quoteData?.Margin_Amount__c || 0;
    }

    get status() {
        return this.quoteData?.Status__c || 'Draft';
    }

    get isDraft() {
        return this.status === 'Draft';
    }

    get isPendingApproval() {
        return this.status === 'Pending Approval';
    }

    get badgeClass() {
        const s = this.status;
        if (s === 'Pending Approval') return 'badge badge-pending';
        if (s === 'Approved') return 'badge badge-approved';
        if (s === 'Rejected') return 'badge badge-rejected';
        return 'badge badge-draft';
    }

    get startDate() {
        if (!this.quoteData?.Start_Date__c) return '-';
        return new Date(this.quoteData.Start_Date__c).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    get endDate() {
        if (!this.quoteData?.End_Date__c) return '-';
        return new Date(this.quoteData.End_Date__c).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    get timePeriod() {
        return this.quoteData?.Time_Period_Metric__c || 'Months';
    }

    handleRefresh() {
        this.dispatchEvent(new CustomEvent('refresh'));
    }

    handleSave() {
        this.dispatchEvent(new CustomEvent('refresh'));
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Quote saved successfully',
                variant: 'success'
            })
        );
    }

    @track isPdfModalOpen = false;
    @track pdfTitle = '';
    @track pdfDescription = '';
    @track isGenerating = false;

    handleGeneratePdf() {
        this.isPdfModalOpen = true;
    }

    closePdfModal() {
        this.isPdfModalOpen = false;
    }

    handlePdfTitleChange(event) {
        this.pdfTitle = event.target.value;
    }

    handlePdfDescChange(event) {
        this.pdfDescription = event.target.value;
    }

    async confirmGeneratePdf() {
        this.isGenerating = true;
        try {
            await generateQuotePdf({
                quoteId: this.recordId,
                title: this.pdfTitle,
                description: this.pdfDescription
            });

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Quote PDF generated successfully',
                    variant: 'success'
                })
            );

            this.isPdfModalOpen = false;
            this.isGenerating = false;
            this.handleRefresh();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                })
            );
            this.isGenerating = false;
        }
    }

    handleAiAssistant() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Sparkle!',
                message: 'AI Assistant is analyzing your quote...',
                variant: 'info'
            })
        );
    }

    async handleSubmitForApproval() {
        try {
            await submitForApproval({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Quote submitted for approval',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error submitting for approval',
                    variant: 'error'
                })
            );
        }
    }

    async handleRecall() {
        try {
            await recallApproval({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Recalled',
                    message: 'Approval has been recalled. Quote is back in Draft.',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error recalling approval',
                    variant: 'error'
                })
            );
        }
    }

    async handleApprove() {
        try {
            await approveQuote({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Approved',
                    message: 'Quote has been approved.',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error approving quote',
                    variant: 'error'
                })
            );
        }
    }

    async handleReject() {
        try {
            await rejectQuote({ quoteId: this.recordId });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Rejected',
                    message: 'Quote has been rejected.',
                    variant: 'warning'
                })
            );
            this.dispatchEvent(new CustomEvent('refresh'));
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error rejecting quote',
                    variant: 'error'
                })
            );
        }
    }
}
