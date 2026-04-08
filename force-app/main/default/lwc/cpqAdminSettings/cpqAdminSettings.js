import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSettings from '@salesforce/apex/CPQSettingsController.getSettings';
import saveSettings from '@salesforce/apex/CPQSettingsController.saveSettings';
import { refreshApex } from '@salesforce/apex';

export default class CpqAdminSettings extends LightningElement {
    @track activeTab = 'general';

    @track settings = {};
    wiredSettingsResult;

    @track editModes = {
        resourceRoles: false,
        products: false,
        addons: false
    };

    @track draftLabels = {
        resourceRoleSingular: '',
        resourceRolePlural: '',
        productSingular: '',
        productPlural: '',
        addOnSingular: '',
        addOnPlural: ''
    };

    @wire(getSettings)
    wiredSettings(result) {
        this.wiredSettingsResult = result;
        if (result.data) {
            this.settings = { ...result.data };
            this.initDraftLabels();
        } else if (result.error) {
            this.showToast('Error', 'Failed to load settings', 'error');
        }
    }

    initDraftLabels() {
        this.draftLabels = {
            resourceRoleSingular: this.settings.Resource_Role_Singular__c || 'Resource Role',
            resourceRolePlural: this.settings.Resource_Role_Plural__c || 'Resource Roles',
            productSingular: this.settings.Product_Singular__c || 'Product',
            productPlural: this.settings.Product_Plural__c || 'Products',
            addOnSingular: this.settings.Add_On_Singular__c || 'Add-on',
            addOnPlural: this.settings.Add_On_Plural__c || 'Add-ons'
        };
    }

    get displayLabels() {
        return {
            resourceRoles: `${this.draftLabels.resourceRoleSingular} / ${this.draftLabels.resourceRolePlural}`,
            products: `${this.draftLabels.productSingular} / ${this.draftLabels.productPlural}`,
            addons: `${this.draftLabels.addOnSingular} / ${this.draftLabels.addOnPlural}`
        };
    }

    get isGeneralTab() { return this.activeTab === 'general'; }
    get isCompanyInfoTab() { return this.activeTab === 'companyInfo'; }
    get isPdfTab() { return this.activeTab === 'pdf'; }
    get isUsersTab() { return this.activeTab === 'users'; }

    get getGeneralTabClass() { return this.activeTab === 'general' ? 'active' : ''; }
    get getCompanyInfoTabClass() { return this.activeTab === 'companyInfo' ? 'active' : ''; }
    get getPdfTabClass() { return this.activeTab === 'pdf' ? 'active' : ''; }
    get getUsersTabClass() { return this.activeTab === 'users' ? 'active' : ''; }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    enableEdit(event) {
        const row = event.currentTarget.dataset.row;
        this.editModes[row] = true;
    }

    cancelEdit(event) {
        const row = event.currentTarget.dataset.row;
        this.editModes[row] = false;
        this.initDraftLabels(); // Revert to saved settings
    }

    handleInputChange(event) {
        const field = event.currentTarget.dataset.field;
        this.draftLabels[field] = event.target.value;
    }

    saveRow(event) {
        const row = event.currentTarget.dataset.row;

        let newSettings = { ...this.settings, sobjectType: 'CPQ_Settings__c' };

        if (row === 'resourceRoles') {
            newSettings.Resource_Role_Singular__c = this.draftLabels.resourceRoleSingular;
            newSettings.Resource_Role_Plural__c = this.draftLabels.resourceRolePlural;
        } else if (row === 'products') {
            newSettings.Product_Singular__c = this.draftLabels.productSingular;
            newSettings.Product_Plural__c = this.draftLabels.productPlural;
        } else if (row === 'addons') {
            newSettings.Add_On_Singular__c = this.draftLabels.addOnSingular;
            newSettings.Add_On_Plural__c = this.draftLabels.addOnPlural;
        }

        saveSettings({ newSettings })
            .then(() => {
                this.showToast('Success', 'Settings saved successfully', 'success');
                this.editModes[row] = false;
                return refreshApex(this.wiredSettingsResult);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to save settings: ' + error.body.message, 'error');
            });
    }

    resetRow(event) {
        const row = event.currentTarget.dataset.row;
        let newSettings = { ...this.settings, sobjectType: 'CPQ_Settings__c' };

        if (row === 'resourceRoles') {
            newSettings.Resource_Role_Singular__c = null;
            newSettings.Resource_Role_Plural__c = null;
            this.draftLabels.resourceRoleSingular = 'Resource Role';
            this.draftLabels.resourceRolePlural = 'Resource Roles';
        } else if (row === 'products') {
            newSettings.Product_Singular__c = null;
            newSettings.Product_Plural__c = null;
            this.draftLabels.productSingular = 'Product';
            this.draftLabels.productPlural = 'Products';
        } else if (row === 'addons') {
            newSettings.Add_On_Singular__c = null;
            newSettings.Add_On_Plural__c = null;
            this.draftLabels.addOnSingular = 'Add-on';
            this.draftLabels.addOnPlural = 'Add-ons';
        }

        saveSettings({ newSettings })
            .then(() => {
                this.showToast('Success', 'Settings reset to defaults', 'success');
                this.editModes[row] = false;
                return refreshApex(this.wiredSettingsResult);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to reset settings: ' + error.body.message, 'error');
            });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}
