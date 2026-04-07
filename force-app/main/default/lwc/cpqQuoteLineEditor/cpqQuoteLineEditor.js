import { LightningElement, api, track, wire } from 'lwc';
import updateLineItem from '@salesforce/apex/QuoteLineItemController.updateLineItem';
import deleteLineItem from '@salesforce/apex/QuoteLineItemController.deleteLineItem';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';
import savePhaseList from '@salesforce/apex/QuoteLineItemController.savePhaseList';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CpqQuoteLineEditor extends LightningElement {
    @api recordId;
    @api lineItems = [];
    @api quoteData;

    @track collapsedPhases = {};
    @track customPhases = [];
    @track selectedIds = {};
    @track pendingChanges = {};
    @track localOrder = [];
    @track phaseOrder = [];
    @track itemPhaseOverrides = {};

    _snapshotJson = '';
    wiredPhaseList;

    @wire(getPhaseList, { quoteId: '$recordId' })
    wiredPhases(result) {
        this.wiredPhaseList = result;
        if (result.data) {
            const phases = result.data.split(',').filter(p => p.trim() !== '');
            this.customPhases = phases;
            if (this.phaseOrder.length === 0) {
                this.phaseOrder = ['Default', ...phases];
            }
        }
    }

    // ─── Snapshot for Undo ───
    _takeSnapshot() {
        this._snapshotJson = JSON.stringify({
            localOrder: this.localOrder,
            phaseOrder: this.phaseOrder,
            itemPhaseOverrides: this.itemPhaseOverrides,
            pendingChanges: this.pendingChanges
        });
    }

    get isUndoDisabled() {
        return this._snapshotJson === '';
    }

    get undoBtnClass() {
        return `btn ${this.isUndoDisabled ? 'btn-disabled' : ''}`;
    }

    handleUndo() {
        if (this._snapshotJson === '') return;
        const snap = JSON.parse(this._snapshotJson);
        this.localOrder = snap.localOrder;
        this.phaseOrder = snap.phaseOrder;
        this.itemPhaseOverrides = snap.itemPhaseOverrides;
        this.pendingChanges = snap.pendingChanges;
        this._snapshotJson = '';
        this.dispatchEvent(new ShowToastEvent({
            title: 'Undone',
            message: 'Last change has been reverted.',
            variant: 'success'
        }));
    }

    // ─── Selection ───
    get hasSelected() {
        return Object.values(this.selectedIds).some(v => v);
    }

    toggleSelect(event) {
        const id = event.target.dataset.id;
        this.selectedIds = { ...this.selectedIds, [id]: event.target.checked };
    }

    toggleSelectAll(event) {
        const checked = event.target.checked;
        const newSel = {};
        this.lineItems.forEach(item => { newSel[item.Id] = checked; });
        this.selectedIds = newSel;
    }

    handleDeleteSelected() {
        const idsToDelete = Object.entries(this.selectedIds)
            .filter(([, v]) => v)
            .map(([k]) => k);

        if (idsToDelete.length === 0) return;

        const promises = idsToDelete.map(id => deleteLineItem({ itemId: id }));
        Promise.all(promises)
            .then(() => {
                this.selectedIds = {};
                this.dispatchEvent(new CustomEvent('refresh'));
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Deleted',
                    message: `${idsToDelete.length} item(s) deleted.`,
                    variant: 'success'
                }));
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error deleting items',
                    variant: 'error'
                }));
            });
    }

    // ─── Computed rows (flat list for template) ───
    get timePeriodMetric() {
        return this.quoteData?.Time_Period_Metric__c || '';
    }

    _getDisplayName(item) {
        if (item.Item_Type__c === 'Resource Role') {
            return item.Resource_Role__r?.Name__c || item.Resource_Role__r?.Name || item.Name;
        }
        if (item.Item_Type__c === 'Product') {
            return item.Product__r?.Name || item.Name;
        }
        if (item.Item_Type__c === 'Add-on') {
            return item.Add_On__r?.Name__c || item.Add_On__r?.Name || item.Name;
        }
        return item.Name;
    }

    _getIcon(type) {
        if (type === 'Resource Role') return '👤';
        if (type === 'Product') return '⚙';
        if (type === 'Add-on') return '➕';
        return '•';
    }

    _getIconClass(type) {
        if (type === 'Resource Role') return 'type-icon role-icon';
        if (type === 'Product') return 'type-icon product-icon';
        if (type === 'Add-on') return 'type-icon addon-icon';
        return 'type-icon';
    }

    _getQtyUnit(metric) {
        if (!metric) return 'item(s)';
        const m = metric.toLowerCase();
        if (m === 'days') return 'day(s)';
        if (m === 'weeks') return 'week(s)';
        if (m === 'months') return 'month(s)';
        if (m === 'quarters') return 'quarter(s)';
        if (m === 'years') return 'year(s)';
        return 'item(s)';
    }

    get flatRows() {
        const phases = this._buildPhaseGroups();
        const rows = [];

        // Use phaseOrder for ordering if set, otherwise default
        const orderedPhaseNames = this.phaseOrder.length > 0
            ? this.phaseOrder
            : ['Default', ...this.customPhases];

        // Include phases that might have items but aren't in phaseOrder yet
        const allPhaseNames = new Set(orderedPhaseNames);
        phases.forEach((_, name) => allPhaseNames.add(name));

        const finalOrder = [...orderedPhaseNames];
        allPhaseNames.forEach(name => {
            if (!finalOrder.includes(name)) finalOrder.push(name);
        });

        const metric = this.timePeriodMetric;
        const qtyUnit = this._getQtyUnit(metric);

        finalOrder.forEach(name => {
            const phase = phases.get(name);
            if (!phase) return;

            // Phase header row
            rows.push({
                key: `phase-${name}`,
                isPhase: true,
                name: name,
                toggleIcon: this.collapsedPhases[name] ? '▸' : '▾',
                isCollapsed: this.collapsedPhases[name] || false
            });

            // Item rows (only if not collapsed)
            if (!this.collapsedPhases[name]) {
                const items = phase.items;

                // Sort by localOrder if available
                const orderMap = {};
                this.localOrder.forEach((id, idx) => { orderMap[id] = idx; });
                const sorted = [...items].sort((a, b) => {
                    const oa = orderMap[a.Id] !== undefined ? orderMap[a.Id] : 9999;
                    const ob = orderMap[b.Id] !== undefined ? orderMap[b.Id] : 9999;
                    return oa - ob;
                });

                sorted.forEach(item => {
                    const isInPhase = name !== 'Default';
                    rows.push({
                        key: `item-${item.Id}`,
                        isPhase: false,
                        Id: item.Id,
                        phase: name,
                        displayName: this._getDisplayName(item),
                        Item_Type__c: item.Item_Type__c,
                        icon: this._getIcon(item.Item_Type__c),
                        iconClass: this._getIconClass(item.Item_Type__c),
                        Name: item.Name,
                        Quantity__c: item.Quantity__c,
                        Discount_Percent__c: item.Discount_Percent__c || 0,
                        startDateFormatted: item.Start_Date__c
                            ? new Date(item.Start_Date__c).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                            : '-',
                        endDateFormatted: item.End_Date__c
                            ? new Date(item.End_Date__c).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                            : '-',
                        formattedBaseRate: this.formatCurrency(item.Base_Rate__c),
                        formattedUnitPrice: this.formatCurrency(item.Unit_Price__c),
                        formattedNetTotal: this.formatCurrency(item.Net_Total__c),
                        qtyUnit: qtyUnit,
                        isSelected: this.selectedIds[item.Id] || false,
                        rowClass: `item-row ${isInPhase ? 'in-phase' : ''} ${item.Item_Type__c === 'Resource Role' ? 'type-role' : item.Item_Type__c === 'Product' ? 'type-product' : 'type-addon'}`
                    });
                });
            }
        });

        return rows;
    }

    _buildPhaseGroups() {
        const phases = new Map();
        const allPhaseNames = ['Default', ...this.customPhases];

        allPhaseNames.forEach(name => {
            phases.set(name, { items: [] });
        });

        this.lineItems.forEach(item => {
            // Use override phase if drag-moved, otherwise use original
            const phaseName = this.itemPhaseOverrides[item.Id] || item.Phase__c || 'Default';
            if (!phases.has(phaseName)) {
                phases.set(phaseName, { items: [] });
            }
            phases.get(phaseName).items.push(item);
        });

        return phases;
    }

    get grandTotal() {
        const total = this.lineItems.reduce((sum, item) => sum + (item.Net_Total__c || 0), 0);
        return this.formatCurrency(total);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value || 0);
    }

    // ─── Phase actions ───
    togglePhase(event) {
        const phase = event.target.dataset.phase || event.currentTarget.dataset.phase;
        this.collapsedPhases = { ...this.collapsedPhases, [phase]: !this.collapsedPhases[phase] };
    }

    handleCollapseAll() {
        const newCollapsed = {};
        const allNames = this.phaseOrder.length > 0
            ? this.phaseOrder
            : ['Default', ...this.customPhases];
        allNames.forEach(name => { newCollapsed[name] = true; });
        this.collapsedPhases = newCollapsed;
    }

    handleAddPhase() {
        this._takeSnapshot();
        const nextPhaseNum = this.customPhases.length + 1;
        const newPhaseName = `Phase ${nextPhaseNum}`;
        this.customPhases = [...this.customPhases, newPhaseName];
        this.phaseOrder = [...this.phaseOrder, newPhaseName];
        savePhaseList({ quoteId: this.recordId, phaseList: this.customPhases.join(',') })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: `Phase "${newPhaseName}" added`,
                    variant: 'success'
                }));
            });
    }

    handleOpenWizard(event) {
        const phase = event.target.dataset.phase;
        this.dispatchEvent(new CustomEvent('openwizard', {
            detail: { phase }
        }));
    }

    // ─── Inline editing ───
    handleUpdateItem(event) {
        this._takeSnapshot();
        const itemId = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.target.value;

        const updateObj = { Id: itemId };
        updateObj[field] = parseFloat(value);

        updateLineItem({ item: updateObj })
            .then(() => {
                this.dispatchEvent(new CustomEvent('refresh'));
            })
            .catch(error => {
                console.error('Update error', error);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error updating item',
                    variant: 'error'
                }));
            });
    }

    // ─── Drag & Drop (items) ───
    _dragItemId = null;
    _dragPhase = null;

    handleDragStart(event) {
        this._dragItemId = event.currentTarget.dataset.id;
        this._dragPhase = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this._dragItemId);
        event.currentTarget.classList.add('dragging');
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDrop(event) {
        event.preventDefault();
        const targetId = event.currentTarget.dataset.id;
        const targetPhase = event.currentTarget.dataset.phase;

        if (this._dragItemId && this._dragItemId !== targetId) {
            this._takeSnapshot();

            // Build current order if not set
            if (this.localOrder.length === 0) {
                this.localOrder = this.lineItems.map(i => i.Id);
            }

            const newOrder = [...this.localOrder];
            const fromIdx = newOrder.indexOf(this._dragItemId);
            const toIdx = newOrder.indexOf(targetId);

            if (fromIdx >= 0) newOrder.splice(fromIdx, 1);
            const insertIdx = toIdx >= 0 ? toIdx : newOrder.length;
            newOrder.splice(insertIdx, 0, this._dragItemId);
            this.localOrder = newOrder;

            // Move to target phase
            if (targetPhase) {
                this.itemPhaseOverrides = {
                    ...this.itemPhaseOverrides,
                    [this._dragItemId]: targetPhase
                };
                // Persist phase change to server
                const updateObj = { Id: this._dragItemId, Phase__c: targetPhase };
                updateLineItem({ item: updateObj })
                    .then(() => this.dispatchEvent(new CustomEvent('refresh')));
            }
        }
        this._dragItemId = null;
        // Remove dragging class from all rows
        this.template.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    }

    // ─── Drag & Drop (phase rows — drop items onto phase) ───
    handlePhaseDragStart(event) {
        this._dragPhase = event.currentTarget.dataset.phase;
        this._dragItemId = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this._dragPhase);
    }

    handlePhaseDrop(event) {
        event.preventDefault();
        const targetPhase = event.currentTarget.dataset.phase;
        const sourceId = event.dataTransfer.getData('text/plain');

        if (this._dragItemId && sourceId) {
            // Item dropped onto phase header
            this._takeSnapshot();
            this.itemPhaseOverrides = {
                ...this.itemPhaseOverrides,
                [sourceId]: targetPhase
            };
            const updateObj = { Id: sourceId, Phase__c: targetPhase };
            updateLineItem({ item: updateObj })
                .then(() => this.dispatchEvent(new CustomEvent('refresh')));
        } else if (this._dragPhase && this._dragPhase !== targetPhase) {
            // Phase reorder
            this._takeSnapshot();
            const newOrder = [...this.phaseOrder];
            const fromIdx = newOrder.indexOf(this._dragPhase);
            const toIdx = newOrder.indexOf(targetPhase);
            if (fromIdx >= 0) newOrder.splice(fromIdx, 1);
            const insertIdx = toIdx >= 0 ? toIdx : newOrder.length;
            newOrder.splice(insertIdx, 0, this._dragPhase);
            this.phaseOrder = newOrder;
        }

        this._dragItemId = null;
        this._dragPhase = null;
    }

    handleToast(event) {
        const msg = event.target.dataset.msg;
        this.dispatchEvent(new ShowToastEvent({
            title: 'Info',
            message: msg,
            variant: 'info'
        }));
    }
}
