import { LightningElement, api, track, wire } from 'lwc';
import updateLineItem from '@salesforce/apex/QuoteLineItemController.updateLineItem';
import deleteLineItem from '@salesforce/apex/QuoteLineItemController.deleteLineItem';
import deletePhaseItems from '@salesforce/apex/QuoteLineItemController.deletePhaseItems';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';
import savePhaseList from '@salesforce/apex/QuoteLineItemController.savePhaseList';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const PHASE_COLORS = [
    'hsla(210, 100%, 97%, 1)', // Light Blue
    'hsla(140, 100%, 97%, 1)', // Light Green
    'hsla(35, 100%, 96%, 1)',  // Light Amber
    'hsla(280, 100%, 97%, 1)', // Light Purple
    'hsla(340, 100%, 97%, 1)', // Light Pink
    'hsla(180, 100%, 96%, 1)', // Light Teal
    'hsla(20, 100%, 97%, 1)',  // Light Orange
    'hsla(60, 100%, 96%, 1)'   // Light Yellow
];

export default class CpqQuoteLineEditor extends LightningElement {
    @api recordId;
    @api lineItems = [];
    @api quoteData;

    @track collapsedPhases = {};
    @track customPhases = [];
    @track selectedIds = {};
    @track localOrder = [];
    @track phaseOrder = [];
    @track phaseDetails = {};
    @track itemPhaseOverrides = {};
    @track editingPhaseName = null;
    @track editingPhaseValue = '';

    _snapshotJson = '';
    _dragItemId = null;
    _dragSourcePhase = null;
    wiredPhaseList;

    @wire(getPhaseList, { quoteId: '$recordId' })
    wiredPhases(result) {
        this.wiredPhaseList = result;
        if (result.data) {
            let raw = result.data.trim();
            if (raw.startsWith('{')) {
                try {
                    let data = JSON.parse(raw);
                    this.phaseOrder = data.order || [];
                    this.phaseDetails = data.details || {};
                    this.customPhases = [...this.phaseOrder];
                } catch(e) { console.error('Error parsing Phase_List__c', e); }
            } else {
                let phases = raw.split(',').filter(p => p.trim() !== '');
                this.customPhases = phases;
                if (this.phaseOrder.length === 0) {
                    this.phaseOrder = [...phases];
                }
            }
        }
    }

    _savePhaseListData() {
        const payload = JSON.stringify({
            order: this.phaseOrder,
            details: this.phaseDetails
        });
        savePhaseList({ quoteId: this.recordId, phaseList: payload });
    }

    // ─── Snapshot for Undo ───
    _takeSnapshot() {
        this._snapshotJson = JSON.stringify({
            localOrder: this.localOrder,
            phaseOrder: this.phaseOrder,
            phaseDetails: this.phaseDetails,
            itemPhaseOverrides: this.itemPhaseOverrides,
            customPhases: this.customPhases
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
        this.phaseDetails = snap.phaseDetails || {};
        this.itemPhaseOverrides = snap.itemPhaseOverrides;
        this.customPhases = snap.customPhases;
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

    // ─── Helpers ───
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

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value || 0);
    }

    // ─── Phase helpers ───
    _getEffectivePhase(item) {
        return this.itemPhaseOverrides[item.Id] || item.Phase__c || null;
    }

    // ─── Build flat rows ───
    get flatRows() {
        const metric = this.timePeriodMetric;
        const qtyUnit = this._getQtyUnit(metric);

        // Group items by effective phase
        const unphasedItems = [];
        const phaseItemsMap = new Map();

        // Initialize phase buckets from phaseOrder
        const phases = this.phaseOrder.length > 0 ? [...this.phaseOrder] : [...this.customPhases];
        phases.forEach(p => phaseItemsMap.set(p, []));

        this.lineItems.forEach(item => {
            const phase = this._getEffectivePhase(item);
            if (!phase || phase === 'Default') {
                unphasedItems.push(item);
            } else {
                if (!phaseItemsMap.has(phase)) {
                    phaseItemsMap.set(phase, []);
                }
                phaseItemsMap.get(phase).push(item);
            }
        });

        // Sort items by localOrder if available
        const orderMap = {};
        this.localOrder.forEach((id, idx) => { orderMap[id] = idx; });
        const sortFn = (a, b) => {
            const oa = orderMap[a.Id] !== undefined ? orderMap[a.Id] : 9999;
            const ob = orderMap[b.Id] !== undefined ? orderMap[b.Id] : 9999;
            return oa - ob;
        };

        const rows = [];

        // 1) Unphased items at top (no phase header, look like root-level items)
        [...unphasedItems].sort(sortFn).forEach(item => {
            rows.push(this._buildItemRow(item, null, qtyUnit, false));
        });

        // 2) Phase groups
        const phaseNames = this.phaseOrder.length > 0 ? [...this.phaseOrder] : [...this.customPhases];
        // Add any phases from phaseItemsMap that aren't in phaseNames
        phaseItemsMap.forEach((_, name) => {
            if (!phaseNames.includes(name)) phaseNames.push(name);
        });

        phaseNames.forEach(name => {
            const items = phaseItemsMap.get(name) || [];

            // Phase header row
            const phaseIndex = phaseNames.indexOf(name);
            const bgColor = phaseIndex >= 0 ? PHASE_COLORS[phaseIndex % PHASE_COLORS.length] : 'transparent';
            const rowStyle = `background-color: ${bgColor} !important;`;
            const borderStyle = phaseIndex >= 0 ? `border-left: 4px solid ${bgColor.replace('97%', '70%').replace('96%', '70%')};` : '';

            const isEditing = this.editingPhaseName === name;
            const details = this.phaseDetails[name] || {};
            rows.push({
                key: `phase-${name}`,
                isPhase: true,
                name: name,
                toggleIcon: this.collapsedPhases[name] ? 'utility:chevronright' : 'utility:chevrondown',
                isCollapsed: this.collapsedPhases[name] || false,
                itemCount: items.length,
                isEditing: isEditing,
                editValue: isEditing ? this.editingPhaseValue : name,
                startDate: details.startDate || '',
                endDate: details.endDate || '',
                rowStyle: rowStyle + borderStyle
            });

            // Items under phase (only if not collapsed)
            if (!this.collapsedPhases[name]) {
                [...items].sort(sortFn).forEach(item => {
                    rows.push(this._buildItemRow(item, name, qtyUnit, true, rowStyle));
                });
            }
        });

        return rows;
    }

    _buildItemRow(item, phaseName, qtyUnit, isIndented, rowStyle = '') {
        return {
            key: `item-${item.Id}`,
            isPhase: false,
            Id: item.Id,
            phase: phaseName || '',
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
            isIndented: isIndented,
            rowClass: `item-row${isIndented ? ' in-phase' : ''}`,
            rowStyle: rowStyle
        };
    }

    get grandTotal() {
        const total = this.lineItems.reduce((sum, item) => sum + (item.Net_Total__c || 0), 0);
        return this.formatCurrency(total);
    }

    // ─── Phase actions ───
    togglePhase(event) {
        const phase = event.target.dataset.phase || event.currentTarget.dataset.phase;
        this.collapsedPhases = { ...this.collapsedPhases, [phase]: !this.collapsedPhases[phase] };
    }

    handleCollapseAll() {
        const newCollapsed = {};
        const allNames = this.phaseOrder.length > 0
            ? [...this.phaseOrder]
            : [...this.customPhases];
        allNames.forEach(name => { newCollapsed[name] = true; });
        this.collapsedPhases = newCollapsed;
    }

    handleAddPhase() {
        this._takeSnapshot();
        const nextPhaseNum = this.customPhases.length + 1;
        const newPhaseName = `Phase ${nextPhaseNum}`;
        this.customPhases = [...this.customPhases, newPhaseName];
        this.phaseOrder = [...this.phaseOrder, newPhaseName];
        this.phaseDetails = { ...this.phaseDetails, [newPhaseName]: {} };
        this._savePhaseListData();
        this.dispatchEvent(new ShowToastEvent({
            title: 'Success',
            message: `Phase "${newPhaseName}" added`,
            variant: 'success'
        }));
    }

    handleOpenWizard(event) {
        const phase = event.target.dataset.phase;
        this.dispatchEvent(new CustomEvent('openwizard', {
            detail: { phase: phase || '' }
        }));
    }

    // ─── Phase name editing ───
    handlePhaseNameDblClick(event) {
        const name = event.currentTarget.dataset.phase;
        this.editingPhaseName = name;
        this.editingPhaseValue = name;
    }

    handlePhaseNameChange(event) {
        this.editingPhaseValue = event.target.value;
    }

    handlePhaseNameBlur() {
        this._commitPhaseRename();
    }

    handlePhaseNameKeyDown(event) {
        if (event.key === 'Enter') {
            this._commitPhaseRename();
        } else if (event.key === 'Escape') {
            this.editingPhaseName = null;
            this.editingPhaseValue = '';
        }
    }

    _commitPhaseRename() {
        const oldName = this.editingPhaseName;
        const newName = this.editingPhaseValue.trim();
        this.editingPhaseName = null;
        this.editingPhaseValue = '';

        if (!newName || newName === oldName) return;

        this._takeSnapshot();

        // Update customPhases
        this.customPhases = this.customPhases.map(p => p === oldName ? newName : p);
        this.phaseOrder = this.phaseOrder.map(p => p === oldName ? newName : p);

        // Update itemPhaseOverrides
        const newOverrides = {};
        Object.entries(this.itemPhaseOverrides).forEach(([id, phase]) => {
            newOverrides[id] = phase === oldName ? newName : phase;
        });
        this.itemPhaseOverrides = newOverrides;

        // Update collapsed state
        if (this.collapsedPhases[oldName] !== undefined) {
            const newCollapsed = { ...this.collapsedPhases };
            newCollapsed[newName] = newCollapsed[oldName];
            delete newCollapsed[oldName];
            this.collapsedPhases = newCollapsed;
        }

        // Update phase details map
        if (this.phaseDetails[oldName]) {
            const newDetails = { ...this.phaseDetails };
            newDetails[newName] = newDetails[oldName];
            delete newDetails[oldName];
            this.phaseDetails = newDetails;
        }

        // Persist phase list
        this._savePhaseListData();

        // Update items that have Phase__c = oldName in the database
        this.lineItems.forEach(item => {
            const effectivePhase = this.itemPhaseOverrides[item.Id] || item.Phase__c;
            if (effectivePhase === newName || item.Phase__c === oldName) {
                const updateObj = { Id: item.Id, Phase__c: newName };
                updateLineItem({ item: updateObj }).catch(err => console.error(err));
            }
        });

        // Refresh to pick up server changes
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('refresh'));
        }, 500);
    }

    // ─── Inline editing & Phase Logic ───
    handleDeletePhase(event) {
        const phaseName = event.target.dataset.phase;
        if (!confirm(`Are you sure you want to delete ${phaseName} and all its items?`)) return;

        this._takeSnapshot();

        // Server-side
        deletePhaseItems({ quoteId: this.recordId, phaseName: phaseName })
            .then(() => {
                // Client-side layer cleanup
                this.customPhases = this.customPhases.filter(p => p !== phaseName);
                this.phaseOrder = this.phaseOrder.filter(p => p !== phaseName);
                if (this.phaseDetails[phaseName]) {
                    const newDetails = { ...this.phaseDetails };
                    delete newDetails[phaseName];
                    this.phaseDetails = newDetails;
                }
                this._savePhaseListData();

                this.dispatchEvent(new CustomEvent('refresh'));
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Deleted',
                    message: `${phaseName} deleted.`,
                    variant: 'success'
                }));
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error deleting phase',
                    variant: 'error'
                }));
            });
    }

    handlePhaseDetailChange(event) {
        const phaseName = event.target.dataset.phase;
        const field = event.target.dataset.field; // 'startDate' or 'endDate'
        const val = event.target.value;

        this._takeSnapshot();

        const currentDetails = this.phaseDetails[phaseName] || {};
        this.phaseDetails = {
            ...this.phaseDetails,
            [phaseName]: { ...currentDetails, [field]: val }
        };
        this._savePhaseListData();
    }

    handleUpdateItem(event) {
        this._takeSnapshot();
        const itemId = event.target.dataset.id;
        const field = event.target.dataset.field;
        let value = parseFloat(event.target.value) || 0;

        if (field === 'Discount_Percent__c') {
            if (value > 100) value = 100;
            if (value < 0) value = 0;
            event.target.value = value;
        } else if (field === 'Quantity__c') {
            if (value < 0) value = 0;
            event.target.value = value;
        }

        const updateObj = { Id: itemId };
        updateObj[field] = value;

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

    // ─── Drag & Drop ───
    handleDragStart(event) {
        this._dragItemId = event.currentTarget.dataset.id;
        this._dragSourcePhase = event.currentTarget.dataset.phase || null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this._dragItemId);
        event.currentTarget.classList.add('dragging');
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        // Add visual indicator
        const row = event.currentTarget;
        if (row.classList.contains('item-row') || row.classList.contains('phase-row')) {
            row.classList.add('drag-over');
        }
    }

    handleDragLeave(event) {
        event.currentTarget.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const targetId = event.currentTarget.dataset.id;
        const targetPhase = event.currentTarget.dataset.phase || '';

        if (!this._dragItemId || this._dragItemId === targetId) {
            this._cleanupDrag();
            return;
        }

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

        // Move to target phase if different
        const currentPhase = this._dragSourcePhase || '';
        if (targetPhase !== currentPhase) {
            const newPhaseValue = targetPhase || null;
            this.itemPhaseOverrides = {
                ...this.itemPhaseOverrides,
                [this._dragItemId]: newPhaseValue
            };
            const updateObj = { Id: this._dragItemId };
            updateObj.Phase__c = newPhaseValue || '';
            updateLineItem({ item: updateObj })
                .then(() => this.dispatchEvent(new CustomEvent('refresh')));
        }

        this._cleanupDrag();
    }

    handlePhaseDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const targetPhase = event.currentTarget.dataset.phase;

        if (this._dragItemId) {
            // Item dropped onto phase header — move item into this phase
            this._takeSnapshot();
            this.itemPhaseOverrides = {
                ...this.itemPhaseOverrides,
                [this._dragItemId]: targetPhase
            };
            const updateObj = { Id: this._dragItemId, Phase__c: targetPhase };
            updateLineItem({ item: updateObj })
                .then(() => this.dispatchEvent(new CustomEvent('refresh')));
        }

        this._cleanupDrag();
    }

    handleDropToRoot(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');

        if (this._dragItemId) {
            // Item dropped outside all phases — remove from phase
            this._takeSnapshot();
            this.itemPhaseOverrides = {
                ...this.itemPhaseOverrides,
                [this._dragItemId]: null
            };
            const updateObj = { Id: this._dragItemId, Phase__c: '' };
            updateLineItem({ item: updateObj })
                .then(() => this.dispatchEvent(new CustomEvent('refresh')));
        }
        this._cleanupDrag();
    }

    _cleanupDrag() {
        this._dragItemId = null;
        this._dragSourcePhase = null;
        this.template.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        this.template.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
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
