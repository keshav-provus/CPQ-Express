import { LightningElement, api, wire, track } from 'lwc';
import getQuoteVersions from '@salesforce/apex/QuoteController.getQuoteVersions';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class CpqDocumentManagement extends NavigationMixin(LightningElement) {
    @api recordId;
    @api quoteName = '';

    @track versions = [];
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
                    cardClass: 'ver-card',
                    badgeClass: `ver-badge ${isActive ? 'ver-badge-active' : 'ver-badge-archive'}`,
                    timeAgo: this._formatTimeAgo(v.CreatedDate),
                    initials: this._getInitials(v.CreatedByName)
                };
            });
        }
    }

    get hasVersions() {
        return this.versions && this.versions.length > 0;
    }

    get versionCountLabel() {
        return this.versions ? String(this.versions.length) : '0';
    }

    get versionCountLabel() {
        return this.versions ? String(this.versions.length) : '0';
    }

    handleVersionSelect(event) {
        const newId = event.currentTarget.dataset.id;
        const v = this.versions.find(ver => ver.Id === newId);
        
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
        } else {
            this.dispatchEvent(new ShowToastEvent({
                title: 'No Document Found',
                message: 'The file for this version is missing or unavailable.',
                variant: 'error'
            }));
        }
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
