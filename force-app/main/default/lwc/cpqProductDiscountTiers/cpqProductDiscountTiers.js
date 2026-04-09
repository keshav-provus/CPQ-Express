import { LightningElement, api, wire, track } from 'lwc';
import getAllDiscountTiers from '@salesforce/apex/QuoteController.getAllDiscountTiers';
import { refreshApex } from '@salesforce/apex';

export default class CpqProductDiscountTiers extends LightningElement {
    @api recordId;
    @api objectApiName;
    @track isModalOpen = false;

    wiredTiersResult;

    get itemIds() {
        return this.recordId ? [this.recordId] : [];
    }

    @wire(getAllDiscountTiers, { itemIds: '$itemIds' })
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
