import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import MARGIN_PERCENT_FIELD from '@salesforce/schema/Quote__c.Margin_Percent__c';

export default class CpqQuoteMarginHealth extends LightningElement {
    @api recordId;
    @api marginThreshold = 15; // Default threshold

    @wire(getRecord, { recordId: '$recordId', fields: [MARGIN_PERCENT_FIELD] })
    quote;

    get margin() {
        return getFieldValue(this.quote.data, MARGIN_PERCENT_FIELD) || 0;
    }

    get healthStatus() {
        return this.margin >= this.marginThreshold ? 'above' : 'below';
    }

    get healthLabel() {
        if (this.margin >= 25) return 'Optimal';
        if (this.margin >= this.marginThreshold) return 'Healthy';
        if (this.margin >= 5) return 'Caution';
        return 'Critical';
    }

    get progressBarClass() {
        if (this.margin >= this.marginThreshold) return 'progress-bar bg-healthy';
        if (this.margin >= 5) return 'progress-bar bg-caution';
        return 'progress-bar bg-critical';
    }

    get statusLabelClass() {
        if (this.margin >= this.marginThreshold) return 'status-label text-healthy';
        if (this.margin >= 5) return 'status-label text-caution';
        return 'status-label text-critical';
    }

    get progressBarStyle() {
        // Cap visual representation at 100%
        const visualMargin = Math.min(Math.max(this.margin * 3, 5), 100); 
        return `width: ${visualMargin}%`;
    }
}
