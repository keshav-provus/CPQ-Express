import { LightningElement, api, wire, track } from 'lwc';
import getProductById from '@salesforce/apex/ProductController.getProductById';
import { refreshApex } from '@salesforce/apex';

export default class CpqProductRecordPage extends LightningElement {
    @api recordId;
    @track activeTab = 'details';

    wiredProductResult;

    @wire(getProductById, { productId: '$recordId' })
    wiredProduct(result) {
        this.wiredProductResult = result;
    }

    get product() {
        return this.wiredProductResult?.data;
    }

    get productPrice() {
        return this.product?.Price__c || 0;
    }

    get isDetails() { return this.activeTab === 'details'; }
    get isRelated() { return this.activeTab === 'related'; }
    get isConfig() { return this.activeTab === 'config'; }

    get detailsTabClass() { return `pb-4 text-sm font-bold ${this.isDetails ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface transition-colors'}`; }
    get relatedTabClass() { return `pb-4 text-sm font-bold ${this.isRelated ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface transition-colors'}`; }
    get configTabClass() { return `pb-4 text-sm font-bold ${this.isConfig ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface transition-colors'}`; }

    handleTabClick(event) {
        this.activeTab = event.target.dataset.tab;
    }

    handleRefresh() {
        refreshApex(this.wiredProductResult);
    }
}
