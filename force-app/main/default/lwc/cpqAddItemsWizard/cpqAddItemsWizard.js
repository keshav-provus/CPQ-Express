import { LightningElement, api, wire, track } from 'lwc';
import getProducts from '@salesforce/apex/ProductController.getActiveProducts';
import addLineItemsFromProducts from '@salesforce/apex/QuoteController.addLineItemsFromProducts';

export default class CpqAddItemsWizard extends LightningElement {
    @api recordId;
    @api targetPhase = 'Default';

    @track selectedType = 'Resource Role';
    @track searchQuery = '';
    @track selectedProductIds = new Set();
    @track isLoading = false;

    wiredProductsResult;

    @wire(getProducts)
    wiredProducts(result) {
        this.wiredProductsResult = result;
    }

    get filteredProducts() {
        const data = this.wiredProductsResult?.data || [];
        return data.filter(prod => {
            const matchesType = prod.Product_Type__c === this.selectedType;
            const matchesSearch = prod.Name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                                 prod.Product_Code__c?.toLowerCase().includes(this.searchQuery.toLowerCase());
            return matchesType && matchesSearch;
        });
    }

    get selectedCount() { return this.selectedProductIds.size; }
    get noSelected() { return this.selectedProductIds.size === 0; }

    get roleTabClass() { return this.selectedType === 'Resource Role' ? 'active' : ''; }
    get prodTabClass() { return this.selectedType === 'Product' ? 'active' : ''; }
    get addonTabClass() { return this.selectedType === 'Add-on' ? 'active' : ''; }

    handleTabChange(event) {
        this.selectedType = event.target.dataset.type;
    }

    handleSearch(event) {
        this.searchQuery = event.target.value;
    }

    handleToggleSelection(event) {
        const id = event.target.dataset.id;
        if (event.target.checked) {
            this.selectedProductIds.add(id);
        } else {
            this.selectedProductIds.delete(id);
        }
    }

    closeWizard() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleAddItems() {
        this.isLoading = true;
        const lineItems = Array.from(this.selectedProductIds).map(pid => ({
            productId: pid,
            quantity: 1,
            discountPercent: 0,
            phase: this.targetPhase
        }));

        addLineItemsFromProducts({
            quoteId: this.recordId,
            lineItemsJson: JSON.stringify(lineItems)
        })
            .then(() => {
                this.dispatchEvent(new CustomEvent('success'));
            })
            .catch(error => {
                console.error('Error adding items:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
}
