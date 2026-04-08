import { LightningElement, api, wire, track } from 'lwc';
import getQuoteVersions from '@salesforce/apex/QuoteController.getQuoteVersions';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';

export default class CpqDocumentManagement extends NavigationMixin(LightningElement) {
    @api recordId;
    @api quoteName = 'QT-7721-B';

    @track versions = [];
    @track selectedVersionId;
    @track wiredVersionsResult;

    @wire(getQuoteVersions, { quoteId: '$recordId' })
    wiredVersions(result) {
        this.wiredVersionsResult = result;
        if (result.data) {
            this.versions = result.data.map(v => {
                const isActive = v.Is_Active__c;
                return {
                    ...v,
                    statusLabel: isActive ? 'CURRENT ACTIVE' : 'ARCHIVE',
                    cardClass: `version-card ${isActive ? 'active' : ''} ${this.selectedVersionId === v.Id ? 'selected' : ''}`,
                    badgeClass: `badge ${isActive ? 'badge-active' : 'badge-archive'}`,
                    timeAgo: this.formatTimeAgo(v.CreatedDate),
                    initials: this.getInitials(v.CreatedBy.Name)
                };
            });

            if (!this.selectedVersionId && this.versions.length > 0) {
                this.selectedVersionId = this.versions[0].Id;
            }
            this.updateCardSelection();
        }
    }

    get hasVersions() {
        return this.versions && this.versions.length > 0;
    }

    get selectedVersionUrl() {
        const selected = this.versions.find(v => v.Id === this.selectedVersionId);
        if (selected && selected.ContentVersionId__c) {
            return `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${selected.ContentVersionId__c}&operationContext=CHATTER`;
        }
        return null;
    }

    handleVersionSelect(event) {
        this.selectedVersionId = event.currentTarget.dataset.id;
        this.updateCardSelection();
    }

    updateCardSelection() {
        this.versions = this.versions.map(v => ({
            ...v,
            cardClass: `version-card ${v.Is_Active__c ? 'active' : ''} ${this.selectedVersionId === v.Id ? 'selected' : ''}`
        }));
    }

    handleShareQuote() {
        const selected = this.versions.find(v => v.Id === this.selectedVersionId);
        if (!selected) return;

        // Navigate to email composer with attachment
        this[NavigationMixin.Navigate]({
            type: 'standard__quickAction',
            attributes: {
                apiName: 'Global.SendEmail'
            },
            state: {
                recordId: this.recordId,
                defaultContentId: selected.ContentVersionId__c
            }
        });
    }

    handleExportPdf() {
        const selected = this.versions.find(v => v.Id === this.selectedVersionId);
        if (selected && selected.ContentVersionId__c) {
            window.open(`/sfc/servlet.shepherd/version/download/${selected.ContentVersionId__c}`, '_blank');
        }
    }

    formatTimeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 60) return `${diffMins} mins ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
        return date.toLocaleDateString();
    }

    getInitials(name) {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    @api
    refresh() {
        return refreshApex(this.wiredVersionsResult);
    }
}
