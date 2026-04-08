import { LightningElement, api } from 'lwc';

export default class CpqProductDetails extends LightningElement {
    @api product;

    get name() { return this.product?.Name || 'N/A'; }
    get code() { return this.product?.Product_Code__c || 'N/A'; }
    get family() { return this.product?.Category__c || 'N/A'; }
    get billingUnit() { return this.product?.Billing_Unit__c || 'N/A'; }
    get description() { return this.product?.Description__c || 'No description available.'; }
}
