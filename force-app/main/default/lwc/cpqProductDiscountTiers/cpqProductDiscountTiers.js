import { LightningElement, api, wire, track } from 'lwc';
import getProductDiscountTiers from '@salesforce/apex/ProductController.getProductDiscountTiers';
import { refreshApex } from '@salesforce/apex';

export default class CpqProductDiscountTiers extends LightningElement {
    @api recordId;
    @track isModalOpen = false;

    wiredTiersResult;

    @wire(getProductDiscountTiers, { productId: '$recordId' })
    wiredTiers(result) {
        this.wiredTiersResult = result;
    }

    get tiers() {
        return this.wiredTiersResult?.data || [];
    }

    get hasTiers() {
        return this.tiers.length > 0;
    }

    handleAddTier() {
        this.isModalOpen = true;
    }

    handleCloseModal() {
        this.isModalOpen = false;
    }

    handleSaveSuccess() {
        this.isModalOpen = false;
        refreshApex(this.wiredTiersResult);
    }
}
