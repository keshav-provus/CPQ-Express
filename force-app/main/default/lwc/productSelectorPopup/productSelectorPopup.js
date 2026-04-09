import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import getActiveProducts from '@salesforce/apex/ProductController.getActiveProducts';
import addLineItemsFromProducts from '@salesforce/apex/QuoteController.addLineItemsFromProducts';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

const PRODUCT_COLUMNS = [
    {
        label: 'Product Name',
        fieldName: 'Name',
        type: 'text',
        sortable: true
    },
    {
        label: 'Product Code',
        fieldName: 'Product_Code__c',
        type: 'text',
        sortable: true
    },
    {
        label: 'Category',
        fieldName: 'CategoryName',
        type: 'text',
        sortable: true
    },
    {
        label: 'Type',
        fieldName: 'Product_Type__c',
        type: 'text',
        sortable: true
    },
    {
        label: 'Price',
        fieldName: 'Price__c',
        type: 'currency',
        typeAttributes: { currencyCode: this.currencyCode },
        sortable: true,
        cellAttributes: { class: 'slds-text-color_success' }
    },
    {
        label: 'Cost',
        fieldName: 'Cost__c',
        type: 'currency',
        typeAttributes: { currencyCode: this.currencyCode },
        sortable: true
    },
    {
        label: 'Qty',
        fieldName: 'Quantity',
        type: 'number',
        editable: true,
        initialWidth: 85,
        cellAttributes: { alignment: 'center' }
    },
    {
        label: 'Discount %',
        fieldName: 'Discount',
        type: 'number',
        editable: true,
        initialWidth: 110,
        cellAttributes: { alignment: 'center' }
    }
];

export default class ProductSelectorPopup extends LightningElement {
    @api recordId;

    @track products = [];
    @track filteredProducts = [];
    @track selectedProductIds = [];
    @track isLoading = false;
    @track searchTerm = '';
    @track sortBy = 'Name';
    @track sortDirection = 'asc';
    @track draftValues = [];

    columns = PRODUCT_COLUMNS;
    wiredProductsResult;
    searchTimeout;
    // Per-product overrides: { productId: { quantity, discount } }
    productOptionsMap = {};

    @wire(getActiveProducts)
    wiredProducts(result) {
        this.wiredProductsResult = result;
        const { data, error } = result;
        if (data) {
            this.products = data.map(product => ({
                ...product,
                CategoryName: product.Category__r ? product.Category__r.Name : '—',
                Quantity: 1,
                Discount: 0
            }));
            this.filteredProducts = [...this.products];
        } else if (error) {
            this.showToast('Error', 'Failed to load products: ' + this.reduceError(error), 'error');
        }
    }

    // --- Close action ---

    handleClose() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    // --- Search ---

    handleSearchChange(event) {
        const searchTerm = event.target.value;
        this.searchTerm = searchTerm;

        clearTimeout(this.searchTimeout);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.searchTimeout = setTimeout(() => {
            this.filterProducts();
        }, 300);
    }

    filterProducts() {
        if (!this.searchTerm || this.searchTerm.trim() === '') {
            this.applyOptionsToProducts(this.products);
            return;
        }

        const term = this.searchTerm.toLowerCase();
        const filtered = this.products.filter(product => {
            const name = (product.Name || '').toLowerCase();
            const code = (product.Product_Code__c || '').toLowerCase();
            const category = (product.CategoryName || '').toLowerCase();
            const type = (product.Product_Type__c || '').toLowerCase();
            return name.includes(term) || code.includes(term) || category.includes(term) || type.includes(term);
        });
        this.applyOptionsToProducts(filtered);
    }

    clearSearch() {
        this.searchTerm = '';
        this.applyOptionsToProducts(this.products);
    }

    // --- Row selection ---

    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        this.selectedProductIds = selectedRows.map(row => row.Id);
    }

    // --- Inline cell editing ---

    handleCellChange(event) {
        const drafts = event.detail.draftValues;

        // Merge draft values into our options map
        drafts.forEach(draft => {
            const id = draft.Id;
            if (!this.productOptionsMap[id]) {
                this.productOptionsMap[id] = { quantity: 1, discount: 0 };
            }
            if (draft.Quantity !== undefined) {
                const qty = parseInt(draft.Quantity, 10);
                this.productOptionsMap[id].quantity = (isNaN(qty) || qty < 1) ? 1 : qty;
            }
            if (draft.Discount !== undefined) {
                let disc = parseFloat(draft.Discount);
                if (isNaN(disc) || disc < 0) disc = 0;
                if (disc > 100) disc = 100;
                this.productOptionsMap[id].discount = disc;
            }
        });

        // Apply changes back into the data and clear draft values
        this.applyOptionsToProducts(
            this.searchTerm ? this.filteredProducts : this.products
        );
        this.draftValues = [];
    }

    /**
     * Applies the productOptionsMap overrides to the given product list
     * and sets it as filteredProducts.
     */
    applyOptionsToProducts(productList) {
        this.filteredProducts = productList.map(product => {
            const opts = this.productOptionsMap[product.Id];
            return {
                ...product,
                Quantity: opts ? opts.quantity : (product.Quantity || 1),
                Discount: opts ? opts.discount : (product.Discount || 0)
            };
        });
    }

    // --- Sorting ---

    handleSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortBy, this.sortDirection);
    }

    sortData(fieldName, direction) {
        const parseData = JSON.parse(JSON.stringify(this.filteredProducts));
        const isReverse = direction === 'asc' ? 1 : -1;

        parseData.sort((a, b) => {
            let valueA = a[fieldName] || '';
            let valueB = b[fieldName] || '';

            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = (valueB || '').toLowerCase();
            }

            if (valueA > valueB) return isReverse;
            if (valueA < valueB) return -isReverse;
            return 0;
        });

        this.filteredProducts = parseData;
    }

    // --- Add selected products ---

    handleAddSelected() {
        if (this.selectedProductIds.length === 0) {
            this.showToast('Warning', 'Please select at least one product.', 'warning');
            return;
        }

        // Build per-product line item data
        const lineItems = this.selectedProductIds.map(id => {
            const opts = this.productOptionsMap[id];
            return {
                productId: id,
                quantity: opts ? opts.quantity : 1,
                discountPercent: opts ? opts.discount : 0
            };
        });

        this.isLoading = true;

        addLineItemsFromProducts({
            quoteId: this.recordId,
            lineItemsJson: JSON.stringify(lineItems)
        })
            .then(() => {
                this.showToast(
                    'Success',
                    `${this.selectedProductIds.length} line item(s) added successfully.`,
                    'success'
                );

                // Close the quick action panel
                this.dispatchEvent(new CloseActionScreenEvent());

                // Notify the platform to refresh the record
                notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to add line items: ' + this.reduceError(error), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // --- Computed properties ---

    get selectedCount() {
        return this.selectedProductIds.length;
    }

    get hasSelectedProducts() {
        return this.selectedProductIds.length > 0;
    }

    get isAddDisabled() {
        return this.selectedProductIds.length === 0;
    }

    get addButtonLabel() {
        const count = this.selectedProductIds.length;
        return count > 0 ? `Add Selected (${count})` : 'Add Selected';
    }

    get productCount() {
        return this.filteredProducts ? this.filteredProducts.length : 0;
    }

    get hasProducts() {
        return this.filteredProducts && this.filteredProducts.length > 0;
    }

    get noResultsMessage() {
        if (this.searchTerm) {
            return `No products found matching "${this.searchTerm}"`;
        }
        return 'No active products available.';
    }

    get hasSearchTerm() {
        return this.searchTerm && this.searchTerm.length > 0;
    }

    // --- Utilities ---

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }

    reduceError(error) {
        if (typeof error === 'string') return error;
        if (error?.body?.message) return error.body.message;
        if (error?.message) return error.message;
        return JSON.stringify(error);
    }
}
