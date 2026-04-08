import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';
import recallApproval from '@salesforce/apex/QuoteController.recallApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from '@salesforce/apex/QuoteController.rejectQuote';
import generateQuotePdf from '@salesforce/apex/QuoteController.generateQuotePdf';
import getTemplates from '@salesforce/apex/QuoteTemplateController.getTemplates';
import { wire } from 'lwc';

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
        return this.quoteData?.Margin_Percent__c || 0;
    }

    get marginAmount() {
        return this.quoteData?.Margin_Amount__c || 0;
    }

    get status() {
        return this.quoteData?.Status__c || 'Draft';
    }

    get startDate() {
        if (!this.quoteData?.Start_Date__c) return '-';
        return new Date(this.quoteData.Start_Date__c).toLocaleDateString();
    }

    get endDate() {
        if (!this.quoteData?.End_Date__c) return '-';
        return new Date(this.quoteData.End_Date__c).toLocaleDateString();
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
    @track templateOptions = [];
    @track selectedTemplateId = '';

    @wire(getTemplates)
    wiredTemplates({ error, data }) {
        if (data) {
            this.templateOptions = data.map(t => ({
                label: t.Name,
                value: t.Id
            }));
            const defaultTemplate = data.find(t => t.Is_Default__c);
            if (defaultTemplate) {
                this.selectedTemplateId = defaultTemplate.Id;
            } else if (data.length > 0) {
                this.selectedTemplateId = data[0].Id;
            }
        }
    }

    handleTemplateChange(event) {
        this.selectedTemplateId = event.detail.value;
    }

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
                description: this.pdfDescription,
                templateId: this.selectedTemplateId
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
}
