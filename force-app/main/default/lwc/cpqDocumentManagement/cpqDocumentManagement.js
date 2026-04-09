import { LightningElement, api, wire, track } from 'lwc';
import getQuoteVersions from '@salesforce/apex/QuoteController.getQuoteVersions';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class CpqDocumentManagement extends NavigationMixin(LightningElement) {
    @api recordId;
    @api quoteName = '';

    @track versions = [];
    @track selectedVersionId = null;
    @track wiredVersionsResult;

    @wire(getQuoteVersions, { quoteId: '$recordId' })
    wiredVersions(result) {
        this.wiredVersionsResult = result;
        if (result.data) {
            this.versions = result.data.map(v => {
                const isActive = v.IsActive;
                return {
                    ...v,
                    statusLabel: isActive ? 'Active' : 'Archive',
                    cardClass: this._buildCardClass(v.Id, isActive),
                    badgeClass: `ver-badge ${isActive ? 'ver-badge-active' : 'ver-badge-archive'}`,
                    timeAgo: this._formatTimeAgo(v.CreatedDate),
                    initials: this._getInitials(v.CreatedByName)
                };
            });
            // Auto-select the first version if none selected
            if (!this.selectedVersionId && this.versions.length > 0) {
                this.selectedVersionId = this.versions[0].Id;
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

    get hasSelectedVersion() {
        return !!this.selectedVersionId;
    }

    get selectedVersion() {
        return this.versions.find(v => v.Id === this.selectedVersionId);
    }

    get selectedVersionLabel() {
        const v = this.selectedVersion;
        return v ? v.VersionLabel : '';
    }

    get selectedVersionTitle() {
        const v = this.selectedVersion;
        return v ? v.Title : '';
    }

    get previewIframeUrl() {
        const v = this.selectedVersion;
        // Use the actual file download endpoint which invokes the browser's native PDF Viewer.
        // Append #view=FitH to automatically zoom to fit the width of the pane.
        if (v && v.ContentVersionId) {
            return `/sfc/servlet.shepherd/version/download/${v.ContentVersionId}#view=FitH`;
        }
        return '';
    }

    handleVersionSelect(event) {
        const newId = event.currentTarget.dataset.id;
        if (newId !== this.selectedVersionId) {
            this.selectedVersionId = newId;
            this._updateCardSelection();
        }
    }

    handleOpenPreview() {
        const v = this.selectedVersion;
        if (v && v.ContentDocumentId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__namedPage',
                attributes: {
                    pageName: 'filePreview'
                },
                state : {
                    selectedRecordId: v.ContentDocumentId
                }
            });
        }
    }

    handleDownloadPdf() {
        const v = this.selectedVersion;
        if (v && v.ContentVersionId) {
            const link = document.createElement('a');
            link.href = `/sfc/servlet.shepherd/version/download/${v.ContentVersionId}`;
            link.download = `${v.VersionLabel || 'Quote'}.pdf`;
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
            cardClass: this._buildCardClass(v.Id, v.IsActive)
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
