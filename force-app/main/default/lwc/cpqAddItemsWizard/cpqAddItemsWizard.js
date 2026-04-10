import { LightningElement, api, wire, track } from 'lwc';
import getResourceRoles from '@salesforce/apex/QuoteController.getResourceRoles';
import getProducts from '@salesforce/apex/QuoteController.getProducts';
import getAddOns from '@salesforce/apex/QuoteController.getAddOns';
import addLineItems from '@salesforce/apex/QuoteLineItemController.addLineItems';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqAddItemsWizard extends LightningElement {
    connectedCallback() {
        this.fetchCurrency();
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    @track currencyCode = 'USD';

        @api recordId;
    @api targetPhase = 'Default';

    @track wizardTab = 'roles';
    @track searchQuery = '';
    @track wizardSelections = { roles: [], products: [], addons: [] };
    @track isLoading = false;

    wiredRoles;
    wiredProducts;
    wiredAddons;

    @wire(getResourceRoles)
    wiredResourceRoles(result) {
        this.wiredRoles = result;
    }

    @wire(getProducts)
    wiredProductRecords(result) {
        this.wiredProducts = result;
    }

    @wire(getAddOns)
    wiredAddOnRecords(result) {
        this.wiredAddons = result;
    }

    get activeCatalog() {
        if (this.wizardTab === 'roles') return this.wiredRoles?.data || [];
        if (this.wizardTab === 'products') return this.wiredProducts?.data || [];
        return this.wiredAddons?.data || [];
    }

    get filteredCatalog() {
        const query = this.searchQuery.toLowerCase();
        return this.activeCatalog.filter(item =>
            item.Name.toLowerCase().includes(query) ||
            (item.Name__c && item.Name__c.toLowerCase().includes(query))
        ).map(item => ({
            ...item,
            displayName: item.Name__c || item.Name,
            displayPrice: this.formatPrice(item.Price__c, item.Billing_Unit__c),
            isSelected: this.wizardSelections[this.wizardTab].includes(item.Id),
            itemClass: `wizard-item ${this.wizardSelections[this.wizardTab].includes(item.Id) ? 'selected' : ''}`
        }));
    }

    formatPrice(price, unit) {
        const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode }).format(price || 0);
        return `${formatted}/${unit || 'Unit'}`;
    }

    get rolesCount() { return this.wizardSelections.roles.length; }
    get productsCount() { return this.wizardSelections.products.length; }
    get addonsCount() { return this.wizardSelections.addons.length; }
    get totalSelected() { return this.rolesCount + this.productsCount + this.addonsCount; }

    get rolesTabClass() { return `wizard-tab ${this.wizardTab === 'roles' ? 'active' : ''}`; }
    get productsTabClass() { return `wizard-tab ${this.wizardTab === 'products' ? 'active' : ''}`; }
    get addonsTabClass() { return `wizard-tab ${this.wizardTab === 'addons' ? 'active' : ''}`; }

    switchWizardTab(event) {
        this.wizardTab = event.target.dataset.tab;
        this.searchQuery = '';
    }

    handleSearch(event) {
        this.searchQuery = event.target.value;
    }

    toggleWizardItem(event) {
        const id = event.currentTarget.dataset.id;
        const sel = [...this.wizardSelections[this.wizardTab]];
        const idx = sel.indexOf(id);
        if (idx >= 0) sel.splice(idx, 1); else sel.push(id);
        this.wizardSelections = { ...this.wizardSelections, [this.wizardTab]: sel };
    }

    closeWizard() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    addSelectedItems() {
        if (this.totalSelected === 0) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Warning',
                message: 'Please select at least one item',
                variant: 'warning'
            }));
            return;
        }

        this.isLoading = true;
        addLineItems({
            quoteId: this.recordId,
            resourceRoleIds: this.wizardSelections.roles,
            productIds: this.wizardSelections.products,
            addonIds: this.wizardSelections.addons,
            phase: this.targetPhase || ''
        })
        .then(() => {
            this.dispatchEvent(new CustomEvent('success'));
        })
        .catch(error => {
            console.error('Add items error', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body.message,
                variant: 'error'
            }));
        })
        .finally(() => {
            this.isLoading = false;
        });
    }

    handleOverlayClick(event) {
        if (event.target === event.currentTarget) this.closeWizard();
    }
}
