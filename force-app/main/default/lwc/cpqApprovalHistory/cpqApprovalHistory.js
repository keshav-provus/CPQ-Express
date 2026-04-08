import { LightningElement, api } from 'lwc';

export default class CpqApprovalHistory extends LightningElement {

    // Pass quote object from parent
    @api quote = null;

    // Build history entries from quote status
    get historyEntries() {
        if (!this.quote) return [];

        const entries = [];

        // Entry 1: Created
        entries.push({
            id:          'created',
            userName:    this.quote.CreatedBy
                             ? this.quote.CreatedBy.Name
                             : 'Unknown',
            action:      'created this quote',
            comment:     '',
            timeDisplay: this.formatTime(this.quote.CreatedDate),
            dotClass:    'entry-dot dot-grey'
        });

        // Entry 2: Submitted (if not Draft)
        if (this.quote.Status__c !== 'Draft') {
            entries.push({
                id:          'submitted',
                userName:    this.quote.LastModifiedBy
                                 ? this.quote.LastModifiedBy.Name
                                 : 'Unknown',
                action:      'submitted for approval',
                comment:     'Submitted for approval',
                timeDisplay: this.formatTime(
                                 this.quote.LastModifiedDate),
                dotClass:    'entry-dot dot-blue'
            });
        }

        // Entry 3: Approved or Rejected
        if (this.quote.Status__c === 'Approved') {
            entries.push({
                id:          'approved',
                userName:    this.quote.LastModifiedBy
                                 ? this.quote.LastModifiedBy.Name
                                 : 'Unknown',
                action:      'approved this quote',
                comment:     '',
                timeDisplay: this.formatTime(
                                 this.quote.LastModifiedDate),
                dotClass:    'entry-dot dot-green'
            });
        } else if (this.quote.Status__c === 'Rejected') {
            entries.push({
                id:          'rejected',
                userName:    this.quote.LastModifiedBy
                                 ? this.quote.LastModifiedBy.Name
                                 : 'Unknown',
                action:      'rejected this quote',
                comment:     'Rejected by manager',
                timeDisplay: this.formatTime(
                                 this.quote.LastModifiedDate),
                dotClass:    'entry-dot dot-red'
            });
        }

        return entries;
    }

    get isEmpty() {
        return !this.quote ||
               this.quote.Status__c === 'Draft';
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day:   'numeric',
            year:  'numeric',
            hour:  '2-digit',
            minute:'2-digit'
        });
    }
}
