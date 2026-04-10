import { LightningElement, api } from 'lwc';

export default class CpqApprovalHistory extends LightningElement {

    // Pass quote object from parent
    @api quote = null;

    // Build history entries from quote approval fields
    get historyEntries() {
        if (!this.quote) return [];

        const entries = [];

        // Entry 1: Created
        entries.push({
            id:          'created',
            icon:        '📝',
            userName:    this.quote.CreatedBy
                             ? this.quote.CreatedBy.Name
                             : 'Unknown',
            action:      'created this quote',
            comment:     '',
            timeDisplay: this.formatTime(this.quote.CreatedDate),
            dotClass:    'entry-dot dot-grey',
            badgeClass:  ''
        });

        // Entry 2: Submitted (if they clicked submit)
        if (this.quote.Submitted_By__c) {
            entries.push({
                id:          'submitted',
                icon:        '📤',
                userName:    this.quote.Submitted_By__r
                                 ? this.quote.Submitted_By__r.Name
                                 : 'Unknown',
                action:      'submitted for approval',
                comment:     '',
                timeDisplay: this.formatTime(this.quote.Submitted_Date__c),
                dotClass:    'entry-dot dot-blue',
                badgeClass:  'action-badge badge-submitted'
            });
        }

        // Entry 3: Auto-approved
        if (this.quote.Auto_Approved__c && this.quote.Status__c === 'Approved') {
            const marginPct = this.quote.Margin_Percent__c != null
                ? this.quote.Margin_Percent__c.toFixed(1) + '%'
                : 'N/A';
            entries.push({
                id:          'auto-approved',
                icon:        '⚡',
                userName:    'System',
                action:      'auto-approved this quote',
                comment:     `Margin ${marginPct} meets the minimum threshold — no manual approval required.`,
                timeDisplay: this.formatTime(this.quote.Approved_Date__c),
                dotClass:    'entry-dot dot-green',
                badgeClass:  'action-badge badge-auto'
            });
        }

        // Entry 4: Manual Approval (not auto)
        if (!this.quote.Auto_Approved__c && this.quote.Approved_By__c && this.quote.Status__c === 'Approved') {
            entries.push({
                id:          'approved',
                icon:        '✓',
                userName:    this.quote.Approved_By__r
                                 ? this.quote.Approved_By__r.Name
                                 : 'Manager',
                action:      'approved this quote',
                comment:     'Manually reviewed and approved by manager.',
                timeDisplay: this.formatTime(this.quote.Approved_Date__c),
                dotClass:    'entry-dot dot-green',
                badgeClass:  'action-badge badge-approved'
            });
        }

        // Entry 5: Rejected
        if (this.quote.Rejected_By__c && this.quote.Status__c === 'Rejected') {
            entries.push({
                id:          'rejected',
                icon:        '✕',
                userName:    this.quote.Rejected_By__r
                                 ? this.quote.Rejected_By__r.Name
                                 : 'Manager',
                action:      'rejected this quote',
                comment:     'Quote was rejected by the approving manager.',
                timeDisplay: this.formatTime(this.quote.Rejected_Date__c),
                dotClass:    'entry-dot dot-red',
                badgeClass:  'action-badge badge-rejected'
            });
        }

        // Entry 6: Pending (waiting for manager action)
        if (this.quote.Status__c === 'Pending Approval' && !this.quote.Approved_By__c && !this.quote.Rejected_By__c) {
            entries.push({
                id:          'pending',
                icon:        '⏳',
                userName:    '',
                action:      'Awaiting manager review',
                comment:     'This quote is pending manager approval.',
                timeDisplay: '',
                dotClass:    'entry-dot dot-amber',
                badgeClass:  'action-badge badge-pending'
            });
        }

        // Entry 7: Recalled (quote was submitted but then recalled back to Draft)
        if (this.quote.Recalled_By__c) {
            entries.push({
                id:          'recalled',
                icon:        '↩',
                userName:    this.quote.Recalled_By__r
                                 ? this.quote.Recalled_By__r.Name
                                 : 'Unknown',
                action:      'recalled this quote',
                comment:     'Quote was recalled and reverted to Draft status.',
                timeDisplay: this.formatTime(this.quote.Recalled_Date__c),
                dotClass:    'entry-dot dot-orange',
                badgeClass:  'action-badge badge-recalled'
            });
        }

        // Fallback: If quote is Draft and was previously submitted (no Recalled fields), show a generic recall
        if (!this.quote.Recalled_By__c && this.quote.Status__c === 'Draft' && this.quote.Submitted_By__c) {
            entries.push({
                id:          'recalled-fallback',
                icon:        '↩',
                userName:    '',
                action:      'Quote was recalled to Draft',
                comment:     'This quote was returned to Draft after being submitted for approval.',
                timeDisplay: '',
                dotClass:    'entry-dot dot-orange',
                badgeClass:  'action-badge badge-recalled'
            });
        }

        return entries;
    }

    get isEmpty() {
        return !this.quote ||
               this.quote.Status__c === 'Draft';
    }

    get statusLabel() {
        if (!this.quote) return '';
        const s = this.quote.Status__c;
        if (s === 'Approved') return 'Approved';
        if (s === 'Rejected') return 'Rejected';
        if (s === 'Pending Approval') return 'Pending';
        return '';
    }

    get statusBadgeClass() {
        if (!this.quote) return 'status-badge';
        const s = this.quote.Status__c;
        if (s === 'Approved') return 'status-badge status-approved';
        if (s === 'Rejected') return 'status-badge status-rejected';
        if (s === 'Pending Approval') return 'status-badge status-pending';
        return 'status-badge';
    }

    get hasStatus() {
        return this.quote && this.quote.Status__c !== 'Draft';
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
