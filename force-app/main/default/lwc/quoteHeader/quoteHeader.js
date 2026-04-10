import { LightningElement, api, wire, track } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import QUOTE_NAME_FIELD from '@salesforce/schema/Quote__c.Name';
import STATUS_FIELD from '@salesforce/schema/Quote__c.Status__c';
import TOTAL_AMOUNT_FIELD from '@salesforce/schema/Quote__c.Total_Amount__c';
import MARGIN_FIELD from '@salesforce/schema/Quote__c.Margin_Percent__c';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

const FIELDS = [QUOTE_NAME_FIELD, STATUS_FIELD, TOTAL_AMOUNT_FIELD, MARGIN_FIELD];

export default class QuoteHeader extends LightningElement {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track currencyCode = 'USD';

        @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    quote;

    get quoteName() {
        return getFieldValue(this.quote.data, QUOTE_NAME_FIELD) || 'Q-00000';
    }

    get quoteStatus() {
        return getFieldValue(this.quote.data, STATUS_FIELD) || 'Draft';
    }

    get totalAmount() {
        return getFieldValue(this.quote.data, TOTAL_AMOUNT_FIELD) || 16170.00;
    }

    get marginPercent() {
        // Return percentage as a decimal (e.g. 0.385 for 38.5%)
        return (getFieldValue(this.quote.data, MARGIN_FIELD) / 100) || 0.385;
    }

    // Mock Data to match the design for missing fields in the schema
    mockSubtotal = 16500.00;
    mockMarginValue = 6220.00;
    mockDiscountValue = -330.00;
    mockDiscountPercent = -0.02;
    mockStartDate = 'Apr 4, 2026';
    mockEndDate = 'May 4, 2026';
    mockTimePeriod = 'Months';
}
