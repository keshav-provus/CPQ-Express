import { LightningElement, api, wire, track } from 'lwc';
import getQuoteVersions from '@salesforce/apex/QuoteController.getQuoteVersions';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqDocumentManagement extends LightningElement {
    @api recordId;
    @api quoteName = '';

    @track versions = [];
    @track selectedVersionId = null; // Don't auto-select
    @track wiredVersionsResult;
    @track previewImageFailed = false;

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
            // Do NOT auto-select — this prevents auto-download
            this._updateCardSelection();
        }
    }

    get hasVersions() {
        return this.versions && this.versions.length > 0;
    }

    get versionCountLabel() {
        return this.versions ? String(this.versions.length) : '0';
    }

    get hasSelectedVersion() {
        return !!this.selectedVersionId;
    }

    get selectedVersion() {
        return this.versions.find(v => v.Id === this.selectedVersionId);
    }

    get selectedVersionLabel() {
        const v = this.selectedVersion;
        return v ? v.Version_Label__c : '';
    }

    get selectedVersionTitle() {
        const v = this.selectedVersion;
        return v ? v.Title__c : '';
    }

    /**
     * Uses the rendition API which returns an IMAGE (not a PDF download).
     * This is safe to put in an <img> tag — won't trigger file download.
     */
    get previewImageUrl() {
        const v = this.selectedVersion;
        if (v && v.ContentVersionId__c) {
            return `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${v.ContentVersionId__c}&operationContext=CHATTER`;
        }
        return '';
    }

    handleVersionSelect(event) {
        const newId = event.currentTarget.dataset.id;
        if (newId !== this.selectedVersionId) {
            this.selectedVersionId = newId;
            this.previewImageFailed = false;
            this._updateCardSelection();
        }
    }

    handleImageError() {
        // Rendition not ready yet (Salesforce generates them async)
        this.previewImageFailed = true;
    }

    handleOpenPreview() {
        const v = this.selectedVersion;
        if (v && v.ContentVersionId__c) {
            // Opens in a new browser tab — the browser's built-in PDF viewer will render it
            window.open(`/sfc/servlet.shepherd/version/download/${v.ContentVersionId__c}`, '_blank');
        }
    }

    handleDownloadPdf() {
        const v = this.selectedVersion;
        if (v && v.ContentVersionId__c) {
            // Create a hidden link to force download
            const link = document.createElement('a');
            link.href = `/sfc/servlet.shepherd/version/download/${v.ContentVersionId__c}`;
            link.download = `${v.Version_Label__c || 'Quote'}.pdf`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
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
