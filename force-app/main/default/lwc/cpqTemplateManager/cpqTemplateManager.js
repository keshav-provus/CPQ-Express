import { LightningElement, track, wire } from 'lwc';
import getTemplates from '@salesforce/apex/QuoteTemplateController.getTemplates';
import saveTemplate from '@salesforce/apex/QuoteTemplateController.saveTemplate';
import setDefaultTemplate from '@salesforce/apex/QuoteTemplateController.setDefaultTemplate';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { deleteRecord } from 'lightning/uiRecordApi';

export default class CpqTemplateManager extends LightningElement {
    @track templates = [];
    @track isLoading = true;
    @track isModalOpen = false;

    @track newName = '';
    @track newDesc = '';
    @track newHtml = '';

    wiredTemplatesResult;

    @wire(getTemplates)
    wiredTemplates(result) {
        this.wiredTemplatesResult = result;
        if (result.data) {
            this.templates = result.data.map(t => ({
                ...t,
                cardClass: `template-card ${t.Is_Default__c ? 'active' : ''}`,
                timeAgo: this.formatTimeAgo(t.CreatedDate)
            }));
            this.isLoading = false;
        } else if (result.error) {
            this.isLoading = false;
            console.error('Error fetching templates:', result.error);
        }
    }

    get hasTemplates() {
        return this.templates && this.templates.length > 0;
    }

    get isSaveDisabled() {
        return !this.newName || !this.newHtml;
    }

    openUploadModal() {
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.newName = '';
        this.newDesc = '';
        this.newHtml = '';
    }

    handleNameChange(e) { this.newName = e.target.value; }
    handleDescChange(e) { this.newDesc = e.target.value; }
    handleHtmlChange(e) { this.newHtml = e.target.value; }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                this.newHtml = reader.result;
                if (!this.newName) {
                    this.newName = file.name.replace('.html', '').replace(/_/g, ' ');
                }
            };
            reader.readAsText(file);
        }
    }

    async handleSave() {
        try {
            await saveTemplate({
                name: this.newName,
                description: this.newDesc,
                htmlContent: this.newHtml
            });
            this.showToast('Success', 'Template saved successfully', 'success');
            await refreshApex(this.wiredTemplatesResult);
            this.closeModal();
        } catch (error) {
            this.showToast('Error', error.body?.message || 'Error saving template', 'error');
        }
    }

    async handleSetDefault(event) {
        const id = event.target.dataset.id;
        try {
            await setDefaultTemplate({ templateId: id });
            this.showToast('Success', 'Default template updated', 'success');
            await refreshApex(this.wiredTemplatesResult);
        } catch (error) {
            this.showToast('Error', 'Error setting default', 'error');
        }
    }

    async handleDelete(event) {
        const id = event.currentTarget.dataset.id;
        
        try {
            await deleteRecord(id);
            this.showToast('Deleted', 'Template removed', 'info');
            await refreshApex(this.wiredTemplatesResult);
        } catch (error) {
            this.showToast('Error', 'Error deleting template', 'error');
        }
    }

    formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
