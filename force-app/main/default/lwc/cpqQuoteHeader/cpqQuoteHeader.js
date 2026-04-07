import { LightningElement, api } from 'lwc';
import { getFieldValue } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const NAME_FIELD = 'Quote__c.Name';
const TOTAL_FIELD = 'Quote__c.Total_Amount__c';
const MARGIN_FIELD = 'Quote__c.Margin_Percent__c';
const STATUS_FIELD = 'Quote__c.Status__c';
const START_DATE_FIELD = 'Quote__c.Start_Date__c';
const DURATION_FIELD = 'Quote__c.Duration_Months__c';

export default class CpqQuoteHeader extends LightningElement {
    @api recordId;
    @api quoteData;

    get quoteName() {
        return getFieldValue(this.quoteData, NAME_FIELD);
    }

    get totalAmount() {
        return getFieldValue(this.quoteData, TOTAL_FIELD) || 0;
    }

    get margin() {
        return getFieldValue(this.quoteData, MARGIN_FIELD) || 0;
    }

    get status() {
        return getFieldValue(this.quoteData, STATUS_FIELD);
    }

    get startDate() {
        return getFieldValue(this.quoteData, START_DATE_FIELD);
    }

    get duration() {
        return getFieldValue(this.quoteData, DURATION_FIELD) || 0;
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
