import { LightningElement, track, wire } from 'lwc';
import getCompanySettings from '@salesforce/apex/AdminSettingsController.getCompanySettings';
import saveCompanySettings from '@salesforce/apex/AdminSettingsController.saveCompanySettings';
import getLicenseInfo from '@salesforce/apex/AdminSettingsController.getLicenseInfo';
import getTeamMembers from '@salesforce/apex/AdminSettingsController.getTeamMembers';
import createUser from '@salesforce/apex/AdminSettingsController.createUser';
import deactivateUser from '@salesforce/apex/AdminSettingsController.deactivateUser';
import updateUserRole from '@salesforce/apex/AdminSettingsController.updateUserRole';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

const actions = [
    { label: 'Change Role', name: 'change_role' },
    { label: 'Deactivate', name: 'deactivate' }
];

export default class AdminSettings extends LightningElement {
    @track currentTab = 'company';
    @track isLoading = false;

    // Company Settings
    @track companySettings = {};
    wiredSettingsResult;

    // Team Data
    @track totalLicenses = 0;
    @track usedLicenses = 0;
    @track teamMembers = [];
    wiredTeamResult;

    // Add User Modal
    @track isAddUserModalOpen = false;
    @track newUser = {
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        role: 'User'
    };

    teamColumns = [
        { label: 'Name', fieldName: 'Name' },
        { label: 'Email', fieldName: 'Email', type: 'email' },
        { label: 'Username', fieldName: 'Username' },
        { label: 'Role', fieldName: 'CPQ_Role__c' },
        { label: 'Last Active', fieldName: 'LastLoginDate', type: 'date', typeAttributes: { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' } },
        { type: 'action', typeAttributes: { rowActions: actions } }
    ];

    // Navigation Getters
    get isCompanyInfo() { return this.currentTab === 'company'; }
    get isPDF() { return this.currentTab === 'pdf'; }
    get isTeam() { return this.currentTab === 'team'; }

    get companyNavClass() { return `slds-nav-vertical__item ${this.isCompanyInfo ? 'slds-is-active' : ''}`; }
    get pdfNavClass() { return `slds-nav-vertical__item ${this.isPDF ? 'slds-is-active' : ''}`; }
    get teamNavClass() { return `slds-nav-vertical__item ${this.isTeam ? 'slds-is-active' : ''}`; }

    get hasTeamMembers() { return this.teamMembers && this.teamMembers.length > 0; }

    get isAdminRole() { return this.newUser.role === 'Admin'; }
    get isManagerRole() { return this.newUser.role === 'Manager'; }
    get isUserRole() { return this.newUser.role === 'User'; }

    // Edit Role Modal
    @track isEditRoleModalOpen = false;
    @track editRoleUserId = null;
    @track editRoleValue = 'User';

    get isEditAdminRole() { return this.editRoleValue === 'Admin'; }
    get isEditManagerRole() { return this.editRoleValue === 'Manager'; }
    get isEditUserRole() { return this.editRoleValue === 'User'; }

    // Wires
    @wire(getCompanySettings)
    wiredSettings(result) {
        this.wiredSettingsResult = result;
        if (result.data) {
            this.companySettings = { ...result.data };
        } else if (result.error) {
            console.error('Error loading company settings', result.error);
        }
    }

    @wire(getLicenseInfo)
    wiredLicenses({ data, error }) {
        if (data) {
            this.totalLicenses = data.TotalLicenses;
            this.usedLicenses = data.UsedLicenses;
        } else if (error) {
            console.error('Error loading licenses', error);
        }
    }

    @wire(getTeamMembers)
    wiredTeam(result) {
        this.wiredTeamResult = result;
        if (result.data) {
            this.teamMembers = result.data;
        } else if (result.error) {
            console.error('Error loading team', result.error);
        }
    }

    // Navigation Handlers
    handleNavCompany() { this.currentTab = 'company'; }
    handleNavPDF() { this.currentTab = 'pdf'; }
    handleNavTeam() { this.currentTab = 'team'; }

    // Company Handlers
    handleSettingChange(event) {
        this.companySettings[event.target.name] = event.target.value;
    }

    async handleSaveCompanySettings() {
        this.isLoading = true;
        try {
            await saveCompanySettings({ settings: this.companySettings });
            this.showToast('Success', 'Company settings saved.', 'success');
            await refreshApex(this.wiredSettingsResult);
        } catch (error) {
            this.showToast('Error', error.body?.message || 'Error saving settings.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // Team Handlers
    openAddUserModal() {
        this.newUser = { firstName: '', lastName: '', email: '', username: '', role: 'User' };
        this.isAddUserModalOpen = true;
    }

    closeAddUserModal() {
        this.isAddUserModalOpen = false;
    }

    handleNewUserChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        this.newUser[field] = value;

        // Auto-sync email to username if username is pristine or matching
        if (field === 'email') {
            if (!this.newUser.username || this.newUser.username === this._previousEmail) {
                this.newUser.username = value;
            }
            this._previousEmail = value;
        }
    }

    async handleCreateUser() {
        // Basic validation
        if (!this.newUser.firstName || !this.newUser.lastName || !this.newUser.email || !this.newUser.username) {
            this.showToast('Error', 'Please fill in all required fields.', 'error');
            return;
        }

        this.isLoading = true;
        try {
            await createUser({
                firstName: this.newUser.firstName,
                lastName: this.newUser.lastName,
                email: this.newUser.email,
                username: this.newUser.username,
                role: this.newUser.role
            });
            this.showToast('Success', 'User created. A password reset email has been sent.', 'success');
            this.closeAddUserModal();
            await refreshApex(this.wiredTeamResult);

            // Note: In real life you'd refresh getLicenseInfo too if cached via imperative call,
            // but wire will eventually update.
        } catch (error) {
            this.showToast('Error', error.body?.message || 'Error creating user.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleTeamRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        if (actionName === 'deactivate') {
            this.isLoading = true;
            try {
                await deactivateUser({ userId: row.Id });
                this.showToast('Success', 'User deactivated.', 'success');
                await refreshApex(this.wiredTeamResult);
            } catch (error) {
                this.showToast('Error', error.body?.message || 'Error deactivating user.', 'error');
            } finally {
                this.isLoading = false;
            }
        } else if (actionName === 'change_role') {
            this.editRoleUserId = row.Id;
            this.editRoleValue = row.CPQ_Role__c || 'User';
            this.isEditRoleModalOpen = true;
        }
    }

    closeEditRoleModal() {
        this.isEditRoleModalOpen = false;
        this.editRoleUserId = null;
    }

    handleEditRoleChange(event) {
        this.editRoleValue = event.target.value;
    }

    async handleSaveRole() {
        if (!this.editRoleUserId || !this.editRoleValue) return;

        this.isLoading = true;
        try {
            await updateUserRole({ userId: this.editRoleUserId, newRole: this.editRoleValue });
            this.showToast('Success', 'User role updated.', 'success');
            this.closeEditRoleModal();
            await refreshApex(this.wiredTeamResult);
        } catch (error) {
            this.showToast('Error', error.body?.message || 'Error updating user role.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
