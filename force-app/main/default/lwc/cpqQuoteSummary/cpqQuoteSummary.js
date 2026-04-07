import { LightningElement, api, wire } from 'lwc';
import getQuoteLines from '@salesforce/apex/QuoteController.getQuoteLines';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import TOTAL_AMOUNT_FIELD from '@salesforce/schema/Quote__c.Total_Amount__c';

export default class CpqQuoteSummary extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [TOTAL_AMOUNT_FIELD] })
    quote;

    @wire(getQuoteLines, { quoteId: '$recordId' })
    lineItems;

    get itemSubtotal() {
        if (!this.lineItems.data) return '$0.00';
        const subtotal = this.lineItems.data.reduce((sum, item) => {
            return sum + (item.Quantity__c * item.Unit_Price__c);
        }, 0);
        return this.formatCurrency(subtotal);
    }

    get itemDiscounts() {
        if (!this.lineItems.data) return '$0.00';
        const totalDiscount = this.lineItems.data.reduce((sum, item) => {
            const discVal = (item.Quantity__c * item.Unit_Price__c) - (item.Net_Total__c || 0);
            return sum + discVal;
        }, 0);
        return this.formatCurrency(totalDiscount);
    }

    get itemGrandTotal() {
        const val = getFieldValue(this.quote.data, TOTAL_AMOUNT_FIELD);
        return this.formatCurrency(val);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value || 0);
    }
}
