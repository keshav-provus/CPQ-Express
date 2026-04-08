import { LightningElement, api, wire, track } from 'lwc';
import getProductAddOns from '@salesforce/apex/ProductController.getProductAddOns';
import { refreshApex } from '@salesforce/apex';

export default class CpqProductAddOns extends LightningElement {
    @api recordId;
    @track isModalOpen = false;

    wiredAddOnsResult;

    @wire(getProductAddOns, { productId: '$recordId' })
    wiredAddOns(result) {
        this.wiredAddOnsResult = result;
    }

    get addOns() {
        return (this.wiredAddOnsResult?.data || []).map(addon => ({
            ...addon,
            displayName: addon.Name__c || addon.Name,
            formattedPrice: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(addon.Price__c || 0)
        }));
    }

    get hasAddOns() {
        return this.addOns.length > 0;
    }

    handleAddAddOn() {
        this.isModalOpen = true;
    }

    handleCloseModal() {
        this.isModalOpen = false;
    }

    handleSaveSuccess() {
        this.isModalOpen = false;
        refreshApex(this.wiredAddOnsResult);
    }
}
