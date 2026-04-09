import { LightningElement, api, track, wire } from 'lwc';
import updateLineItem from '@salesforce/apex/QuoteLineItemController.updateLineItem';
import deleteLineItem from '@salesforce/apex/QuoteLineItemController.deleteLineItem';
import deletePhaseItems from '@salesforce/apex/QuoteLineItemController.deletePhaseItems';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';
import savePhaseList from '@salesforce/apex/QuoteLineItemController.savePhaseList';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Pastel color palette for phases
const PHASE_COLORS = [
    { bg: '#EFF6FF', border: '#BFDBFE', itemBg: '#F5F9FF' },  // Sky Blue
    { bg: '#F0FDF4', border: '#BBF7D0', itemBg: '#F5FFF8' },  // Mint Green
    { bg: '#FFFBEB', border: '#FDE68A', itemBg: '#FFFEF5' },  // Warm Amber
    { bg: '#FDF4FF', border: '#F0ABFC', itemBg: '#FEF9FF' },  // Soft Purple
    { bg: '#FFF1F2', border: '#FECDD3', itemBg: '#FFF8F8' },  // Rose Pink
    { bg: '#F0FDFA', border: '#99F6E4', itemBg: '#F5FEFC' },  // Teal
    { bg: '#FFF7ED', border: '#FED7AA', itemBg: '#FFFCF5' },  // Peach
    { bg: '#F5F3FF', border: '#DDD6FE', itemBg: '#FAF8FF' },  // Lavender
];

export default class CpqQuoteLineEditor extends LightningElement {
    @api recordId;
    @api lineItems = [];
    @api quoteData;

    @track collapsedPhases = {};
    @track customPhases = [];
    @track selectedIds = {};
    @track selectedPhases = {};
    @track localOrder = [];
    @track phaseOrder = [];
    @track phaseDetails = {};
    @track itemPhaseOverrides = {};
    @track editingPhaseName = null;
    @track editingPhaseValue = '';
    @track revealedDateFields = {};

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

    get isEditable() {
        return this.quoteData?.Status__c === 'Draft';
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
        return Object.values(this.selectedIds).some(v => v) || 
               Object.values(this.selectedPhases).some(v => v);
    }

    toggleSelect(event) {
        const id = event.target.dataset.id;
        const phase = event.target.dataset.targetPhase;
        
        if (id) {
            this.selectedIds = { ...this.selectedIds, [id]: event.target.checked };
        } else if (phase) {
            this.selectedPhases = { ...this.selectedPhases, [phase]: event.target.checked };
        }
    }

    toggleSelectAll(event) {
        const checked = event.target.checked;
        const newSel = {};
        this.lineItems.forEach(item => { newSel[item.Id] = checked; });
        this.selectedIds = newSel;

        const newPhaseSel = {};
        this.phaseOrder.forEach(p => { newPhaseSel[p] = checked; });
        this.selectedPhases = newPhaseSel;
    }

    handleDeleteSelected() {
        const idsToDelete = Object.entries(this.selectedIds)
            .filter(([, v]) => v)
            .map(([k]) => k);
        const phasesToDelete = Object.entries(this.selectedPhases)
            .filter(([, v]) => v)
            .map(([k]) => k);

        if (idsToDelete.length === 0 && phasesToDelete.length === 0) return;

        this._takeSnapshot();

        let promises = [];
        
        idsToDelete.forEach(id => {
            const item = this.lineItems.find(i => i.Id === id);
            const itemPhase = this._getEffectivePhase(item);
            if (!phasesToDelete.includes(itemPhase)) {
                promises.push(deleteLineItem({ itemId: id }));
            }
        });

        phasesToDelete.forEach(phaseName => {
            promises.push(deletePhaseItems({ quoteId: this.recordId, phaseName: phaseName }));
        });

        Promise.all(promises)
            .then(() => {
                phasesToDelete.forEach(phaseName => {
                    this.customPhases = this.customPhases.filter(p => p !== phaseName);
                    this.phaseOrder = this.phaseOrder.filter(p => p !== phaseName);
                    if (this.phaseDetails[phaseName]) {
                        const newDetails = { ...this.phaseDetails };
                        delete newDetails[phaseName];
                        this.phaseDetails = newDetails;
                    }
                });
                if (phasesToDelete.length > 0) {
                    this._savePhaseListData();
                }

                this.selectedIds = {};
                this.selectedPhases = {};
                this.dispatchEvent(new CustomEvent('refresh'));
                
                const msg = `${idsToDelete.length} item(s) and ${phasesToDelete.length} phase(s) deleted.`;
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Deleted',
                    message: msg,
                    variant: 'success'
                }));
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Error deleting selected content',
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
            currency: undefined,
        }).format(value || 0);
    }

    formatNumber(value) {
        if (value === null || value === undefined) return '0';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format(value);
    }

    // ─── Phase helpers ───
    _getEffectivePhase(item) {
        return this.itemPhaseOverrides[item.Id] || item.Phase__c || null;
    }

    _getPhaseColor(phaseIndex) {
        return PHASE_COLORS[phaseIndex % PHASE_COLORS.length];
    }

    // ─── Collapse / Expand All ───
    get allPhaseNames() {
        return this.phaseOrder.length > 0
            ? [...this.phaseOrder]
            : [...this.customPhases];
    }

    get isAllCollapsed() {
        const names = this.allPhaseNames;
        if (names.length === 0) return false;
        return names.every(name => this.collapsedPhases[name]);
    }

    handleToggleCollapseAll() {
        const names = this.allPhaseNames;
        if (this.isAllCollapsed) {
            this.collapsedPhases = {};
        } else {
            const newCollapsed = {};
            names.forEach(name => { newCollapsed[name] = true; });
            this.collapsedPhases = newCollapsed;
        }
    }

    // ─── Date placeholder click ───
    handleDatePlaceholderClick(event) {
        const phase = event.target.dataset.phase;
        const field = event.target.dataset.field;
        const key = `${phase}__${field}`;
        this.revealedDateFields = { ...this.revealedDateFields, [key]: true };

        // Focus the date input after render
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const input = this.template.querySelector(
                `input[type="date"][data-phase="${phase}"][data-field="${field}"]`
            );
            if (input) input.focus();
        }, 50);
    }

    // ─── Compute aggregated data for collapsed phases ───
    _computePhaseAggregates(items) {
        if (!items || items.length === 0) {
            return {
                aggQuantity: '0',
                aggBaseRate: this.formatCurrency(0),
                aggUnitPrice: this.formatCurrency(0),
                aggDiscount: '0.0%',
                aggNetTotal: this.formatCurrency(0),
                aggStartDate: '-',
                aggEndDate: '-'
            };
        }

        const count = items.length;
        let totalBaseRate = 0;
        let totalUnitPrice = 0;
        let totalDiscount = 0;
        let totalNetTotal = 0;
        let minStart = null;
        let maxEnd = null;

        items.forEach(item => {
            totalBaseRate += (item.Base_Rate__c || 0);
            totalUnitPrice += (item.Unit_Price__c || 0);
            totalDiscount += (item.Discount_Percent__c || 0);
            totalNetTotal += (item.Net_Total__c || 0);

            if (item.Start_Date__c) {
                const d = new Date(item.Start_Date__c);
                if (!minStart || d < minStart) minStart = d;
            }
            if (item.End_Date__c) {
                const d = new Date(item.End_Date__c);
                if (!maxEnd || d > maxEnd) maxEnd = d;
            }
        });

        const avgBaseRate = totalBaseRate / count;
        const avgUnitPrice = totalUnitPrice / count;
        const avgDiscount = totalDiscount / count;

        const dateOpts = { month: 'short', day: '2-digit', year: 'numeric' };

        return {
            aggQuantity: String(count),
            aggBaseRate: this.formatCurrency(avgBaseRate),
            aggUnitPrice: this.formatCurrency(avgUnitPrice),
            aggDiscount: this.formatNumber(avgDiscount) + '%',
            aggNetTotal: this.formatCurrency(totalNetTotal),
            aggStartDate: minStart ? minStart.toLocaleDateString('en-US', dateOpts) : '-',
            aggEndDate: maxEnd ? maxEnd.toLocaleDateString('en-US', dateOpts) : '-'
        };
    }

    // ─── Build flat rows ───
    get flatRows() {
        const metric = this.timePeriodMetric;
        const qtyUnit = this._getQtyUnit(metric);

        // Group items by effective phase
        const unphasedItems = [];
        const phaseItemsMap = new Map();

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

        // 1) Phase groups first
        const phaseNames = this.phaseOrder.length > 0 ? [...this.phaseOrder] : [...this.customPhases];
        phaseItemsMap.forEach((_, name) => {
            if (!phaseNames.includes(name)) phaseNames.push(name);
        });

        phaseNames.forEach((name, phaseIndex) => {
            const items = phaseItemsMap.get(name) || [];
            const isCollapsed = this.collapsedPhases[name] || false;
            const isEditing = this.editingPhaseName === name;
            const details = this.phaseDetails[name] || {};
            const color = this._getPhaseColor(phaseIndex);

            // Compute aggregates for collapsed mode
            const agg = this._computePhaseAggregates(items);

            // Check if date fields should show input or placeholder
            const startKey = `${name}__startDate`;
            const endKey = `${name}__endDate`;
            const hasStartDate = !!(details.startDate) || this.revealedDateFields[startKey];
            const hasEndDate = !!(details.endDate) || this.revealedDateFields[endKey];

            const phaseBgStyle = `background-color: ${color.bg};`;
            const phaseRowStyle = `background-color: ${color.bg}; border-left: 3px solid ${color.border};`;

            rows.push({
                key: `phase-${name}`,
                isPhase: true,
                name: name,
                toggleIcon: isCollapsed ? 'utility:chevronright' : 'utility:chevrondown',
                isCollapsed: isCollapsed,
                itemCount: items.length,
                isEditing: isEditing,
                editValue: isEditing ? this.editingPhaseValue : name,
                startDate: details.startDate || '',
                endDate: details.endDate || '',
                hasStartDate: hasStartDate,
                hasEndDate: hasEndDate,
                isSelected: this.selectedPhases[name] || false,
                phaseRowClass: 'phase-row',
                phaseRowStyle: phaseRowStyle,
                phaseBgStyle: phaseBgStyle,
                ...agg
            });

            // Items under phase (only if not collapsed)
            if (!isCollapsed) {
                [...items].sort(sortFn).forEach(item => {
                    rows.push(this._buildItemRow(item, name, qtyUnit, true, color));
                });
            }
        });

        // 2) Unphased items after phases
        [...unphasedItems].sort(sortFn).forEach(item => {
            rows.push(this._buildItemRow(item, null, qtyUnit, false, null));
        });

        return rows;
    }

    _buildItemRow(item, phaseName, qtyUnit, isIndented, color) {
        const rowBg = color ? `background-color: ${color.itemBg};` : '';
        const stickyBg = color ? `background-color: ${color.itemBg};` : 'background-color: #fff;';

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
            nameWrapClass: isIndented ? 'name-wrap-indented' : 'name-wrap',
            rowClass: `item-row${isIndented ? ' in-phase' : ''}`,
            rowStyle: rowBg,
            stickyBgStyle: stickyBg
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

        this.customPhases = this.customPhases.map(p => p === oldName ? newName : p);
        this.phaseOrder = this.phaseOrder.map(p => p === oldName ? newName : p);

        const newOverrides = {};
        Object.entries(this.itemPhaseOverrides).forEach(([id, phase]) => {
            newOverrides[id] = phase === oldName ? newName : phase;
        });
        this.itemPhaseOverrides = newOverrides;

        if (this.collapsedPhases[oldName] !== undefined) {
            const newCollapsed = { ...this.collapsedPhases };
            newCollapsed[newName] = newCollapsed[oldName];
            delete newCollapsed[oldName];
            this.collapsedPhases = newCollapsed;
        }

        if (this.phaseDetails[oldName]) {
            const newDetails = { ...this.phaseDetails };
            newDetails[newName] = newDetails[oldName];
            delete newDetails[oldName];
            this.phaseDetails = newDetails;
        }

        this._savePhaseListData();

        this.lineItems.forEach(item => {
            const effectivePhase = this.itemPhaseOverrides[item.Id] || item.Phase__c;
            if (effectivePhase === newName || item.Phase__c === oldName) {
                const updateObj = { Id: item.Id, Phase__c: newName };
                updateLineItem({ item: updateObj }).catch(err => console.error(err));
            }
        });

        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('refresh'));
        }, 500);
    }

    // ─── Validation Helpers ───
    _validateItemAgainstPhase(item, phaseName, itemStart = null, itemEnd = null) {
        if (!phaseName) return true;
        const details = this.phaseDetails[phaseName];
        if (!details || (!details.startDate && !details.endDate)) return true;

        const pStart = details.startDate ? new Date(details.startDate) : null;
        const pEnd = details.endDate ? new Date(details.endDate) : null;
        const iStart = new Date(itemStart || item.Start_Date__c);
        const iEnd = new Date(itemEnd || item.End_Date__c);

        if (pStart && iStart < pStart) return false;
        if (pEnd && iEnd > pEnd) return false;
        return true;
    }

    _validatePhaseAgainstItems(phaseName, newStart, newEnd) {
        const pStart = newStart ? new Date(newStart) : null;
        const pEnd = newEnd ? new Date(newEnd) : null;

        const items = this.lineItems.filter(i => {
            const eff = this.itemPhaseOverrides[i.Id] || i.Phase__c;
            return eff === phaseName;
        });

        for (const item of items) {
            const iStart = new Date(item.Start_Date__c);
            const iEnd = new Date(item.End_Date__c);
            if (pStart && iStart < pStart) return false;
            if (pEnd && iEnd > pEnd) return false;
        }
        return true;
    }

    handlePhaseDetailChange(event) {
        const phaseName = event.target.dataset.phase;
        const field = event.target.dataset.field;
        const val = event.target.value;

        const details = this.phaseDetails[phaseName] || {};

        this._takeSnapshot();
        this.phaseDetails = {
            ...this.phaseDetails,
            [phaseName]: { ...details, [field]: val }
        };
        this._savePhaseListData();
    }

    handleUpdateItem(event) {
        const itemId = event.target.dataset.id;
        const field = event.target.dataset.field;
        let value = event.target.value;

        const item = this.lineItems.find(i => i.Id === itemId);
        const phaseName = this._getEffectivePhase(item);

        if (field === 'Start_Date__c' || field === 'End_Date__c') {
            const iStart = field === 'Start_Date__c' ? value : item.Start_Date__c;
            const iEnd = field === 'End_Date__c' ? value : item.End_Date__c;
            if (!this._validateItemAgainstPhase(item, phaseName, iStart, iEnd)) {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Invalid Dates',
                    message: 'Item dates must be within the phase start and end dates.',
                    variant: 'error'
                }));
                event.target.value = item[field];
                return;
            }
        }

        this._takeSnapshot();
        let finalValue = value;

        if (field === 'Discount_Percent__c') {
            finalValue = parseFloat(value) || 0;
            if (finalValue > 100) finalValue = 100;
            if (finalValue < 0) finalValue = 0;
            event.target.value = finalValue;
        } else if (field === 'Quantity__c') {
            finalValue = parseFloat(value) || 0;
            if (finalValue < 0) finalValue = 0;
            event.target.value = finalValue;
        }

        const updateObj = { Id: itemId };
        updateObj[field] = finalValue;

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
        const dropTargetId = event.currentTarget.dataset.id;
        const targetPhase = event.currentTarget.dataset.phase || '';

        const item = this.lineItems.find(i => i.Id === this._dragItemId);
        if (targetPhase && !this._validateItemAgainstPhase(item, targetPhase)) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Invalid Phase',
                message: 'This item dates are outside the target phase duration.',
                variant: 'error'
            }));
            return;
        }

        this._takeSnapshot();
        if (!this._dragItemId || this._dragItemId === dropTargetId) {
            this._cleanupDrag();
            return;
        }

        if (this.localOrder.length === 0) {
            this.localOrder = this.lineItems.map(i => i.Id);
        }

        const newOrder = [...this.localOrder];
        const fromIdx = newOrder.indexOf(this._dragItemId);
        const toIdx = newOrder.indexOf(dropTargetId);

        if (fromIdx >= 0) newOrder.splice(fromIdx, 1);
        const insertIdx = toIdx >= 0 ? toIdx : newOrder.length;
        newOrder.splice(insertIdx, 0, this._dragItemId);
        this.localOrder = newOrder;

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

        const item = this.lineItems.find(i => i.Id === this._dragItemId);
        if (targetPhase && !this._validateItemAgainstPhase(item, targetPhase)) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Invalid Phase',
                message: 'This item dates are outside the target phase duration.',
                variant: 'error'
            }));
            return;
        }

        if (this._dragItemId) {
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
