import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import NAME_FIELD from '@salesforce/schema/Quote__c.Name';
import STATUS_FIELD from '@salesforce/schema/Quote__c.Status__c';
import ACCOUNT_NAME_FIELD from '@salesforce/schema/Quote__c.Account__r.Name';
import TOTAL_AMOUNT_FIELD from '@salesforce/schema/Quote__c.Total_Amount__c';
import MARGIN_PERCENT_FIELD from '@salesforce/schema/Quote__c.Margin_Percent__c';
import VALID_UNTIL_FIELD from '@salesforce/schema/Quote__c.Valid_Until__c';

const FIELDS = [NAME_FIELD, STATUS_FIELD, ACCOUNT_NAME_FIELD, TOTAL_AMOUNT_FIELD, MARGIN_PERCENT_FIELD, VALID_UNTIL_FIELD];

export default class CpqQuoteHeader extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    quote;

    get quoteName() {
        return getFieldValue(this.quote.data, NAME_FIELD);
    }

    get quoteStatus() {
        return getFieldValue(this.quote.data, STATUS_FIELD);
    }

    get accountName() {
        return getFieldValue(this.quote.data, ACCOUNT_NAME_FIELD);
    }

    get marginPercent() {
        const val = getFieldValue(this.quote.data, MARGIN_PERCENT_FIELD);
        return val ? val.toFixed(1) : '0.0';
    }

    get formattedTotal() {
        const val = getFieldValue(this.quote.data, TOTAL_AMOUNT_FIELD);
        if (val === undefined || val === null) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(val);
    }

    get formattedExpiration() {
        const val = getFieldValue(this.quote.data, VALID_UNTIL_FIELD);
        if (!val) return 'N/A';
        return new Date(val).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    get statusBadgeClass() {
        const status = (this.quoteStatus || '').toLowerCase();
        return `status-badge badge-${status}`;
    }
}
