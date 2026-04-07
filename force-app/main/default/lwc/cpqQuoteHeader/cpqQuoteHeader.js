import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

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

    handleGeneratePdf() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Info',
                message: 'PDF generation feature coming soon',
                variant: 'info'
            })
        );
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
