import { LightningElement, api, wire, track } from 'lwc';
import { getRecord, getFieldValue, refreshApex } from 'lightning/uiRecordApi';
import getQuoteLinesByQuoteId from '@salesforce/apex/QuoteController.getQuoteLines';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const QUOTE_FIELDS = [
    'Quote__c.Name',
    'Quote__c.Total_Amount__c',
    'Quote__c.Total_Cost__c',
    'Quote__c.Margin_Percent__c',
    'Quote__c.Status__c',
    'Quote__c.Start_Date__c',
    'Quote__c.Duration_Months__c'
];

export default class CpqQuoteRecordPage extends LightningElement {
    @api recordId;

    @track activeTab = 'summary';
    @track isWizardOpen = false;
    @track targetPhase = 'Default';

    wiredQuoteResult;
    wiredLinesResult;

    @wire(getRecord, { recordId: '$recordId', fields: QUOTE_FIELDS })
    wiredQuote(result) {
        this.wiredQuoteResult = result;
    }

    @wire(getQuoteLinesByQuoteId, { quoteId: '$recordId' })
    wiredLines(result) {
        this.wiredLinesResult = result;
    }

    get quoteData() {
        return this.wiredQuoteResult?.data;
    }

    get lineItems() {
        return this.wiredLinesResult?.data || [];
    }

    handleRefresh() {
        refreshApex(this.wiredQuoteResult);
        refreshApex(this.wiredLinesResult);
    }

    handleOpenWizard(event) {
        this.targetPhase = event.detail.phase || 'Default';
        this.isWizardOpen = true;
    }

    handleCloseWizard() {
        this.isWizardOpen = false;
    }

    handleWizardSuccess() {
        this.isWizardOpen = false;
        this.handleRefresh();
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Line items added successfully',
                variant: 'success'
            })
        );
    }
}
