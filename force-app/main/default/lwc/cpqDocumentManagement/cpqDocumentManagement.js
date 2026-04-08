import { LightningElement, api, wire, track } from 'lwc';
import getQuoteVersions from '@salesforce/apex/QuoteController.getQuoteVersions';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqDocumentManagement extends LightningElement {
    @api recordId;
    @api quoteName = '';

    @track versions = [];
    @track selectedVersionId;
    @track wiredVersionsResult;
    @track isLoading = false;

    @wire(getQuoteVersions, { quoteId: '$recordId' })
    wiredVersions(result) {
        this.wiredVersionsResult = result;
        if (result.data) {
            this.versions = result.data.map(v => {
                const isActive = v.Is_Active__c;
                return {
                    ...v,
                    statusLabel: isActive ? 'Active' : 'Archive',
                    cardClass: this._buildCardClass(v.Id, isActive),
                    badgeClass: `ver-badge ${isActive ? 'ver-badge-active' : 'ver-badge-archive'}`,
                    timeAgo: this._formatTimeAgo(v.CreatedDate),
                    initials: this._getInitials(v.CreatedBy?.Name)
                };
            });

            // Auto-select first version
            if (!this.selectedVersionId && this.versions.length > 0) {
                this.selectedVersionId = this.versions[0].Id;
                this.isLoading = true;
            }
            this._updateCardSelection();
        }
    }

    get hasVersions() {
        return this.versions && this.versions.length > 0;
    }

    get versionCountLabel() {
        return this.versions ? String(this.versions.length) : '0';
    }

    get noVersionSelected() {
        return !this.selectedVersionId;
    }

    get selectedVersionUrl() {
        const selected = this.versions.find(v => v.Id === this.selectedVersionId);
        if (selected && selected.ContentVersionId__c) {
            return `/sfc/servlet.shepherd/version/download/${selected.ContentVersionId__c}?operationContext=S1`;
        }
        return null;
    }

    get showPlaceholder() {
        return !this.selectedVersionUrl && !this.isLoading;
    }

    handleVersionSelect(event) {
        const newId = event.currentTarget.dataset.id;
        if (newId !== this.selectedVersionId) {
            this.selectedVersionId = newId;
            this.isLoading = true;
            this._updateCardSelection();
        }
    }

    handleIframeLoad() {
        this.isLoading = false;
    }

    handleIframeError() {
        this.isLoading = false;
    }

    handleDownloadPdf() {
        const selected = this.versions.find(v => v.Id === this.selectedVersionId);
        if (selected && selected.ContentVersionId__c) {
            window.open(`/sfc/servlet.shepherd/version/download/${selected.ContentVersionId__c}`, '_blank');
        } else {
            this.dispatchEvent(new ShowToastEvent({
                title: 'No Version Selected',
                message: 'Please select a version to download.',
                variant: 'warning'
            }));
        }
    }

    _buildCardClass(versionId, isActive) {
        let cls = 'ver-card';
        if (isActive) cls += ' ver-card-active';
        if (this.selectedVersionId === versionId) cls += ' ver-card-selected';
        return cls;
    }

    _updateCardSelection() {
        this.versions = this.versions.map(v => ({
            ...v,
            cardClass: this._buildCardClass(v.Id, v.Is_Active__c)
        }));
    }

    _formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    _getInitials(name) {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    @api
    refresh() {
        return refreshApex(this.wiredVersionsResult);
    }
}
