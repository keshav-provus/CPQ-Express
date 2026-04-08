import { LightningElement, api, track, wire } from 'lwc';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';

// Bar colors by item type
const TYPE_COLORS = {
    'Product':       { bg: '#3b82f6', light: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    'Add-on':        { bg: '#f59e0b', light: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'Resource Role': { bg: '#10b981', light: '#d1fae5', text: '#065f46', dot: '#10b981' }
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_WIDTH = 120; // px per month

export default class CpqQuoteTimeline extends LightningElement {
    @api recordId;
    @api lineItems = [];
    @api quoteData;

    @track tooltipVisible = false;
    @track tooltipData = {};
    @track tooltipX = 0;
    @track tooltipY = 0;
    @track phaseOrder = [];

    @wire(getPhaseList, { quoteId: '$recordId' })
    wiredPhases(result) {
        if (result.data) {
            let raw = result.data.trim();
            if (raw.startsWith('{')) {
                try {
                    let data = JSON.parse(raw);
                    this.phaseOrder = data.order || [];
                } catch(e) {
                    this.phaseOrder = [];
                }
            } else {
                this.phaseOrder = raw.split(',').filter(p => p.trim() !== '');
            }
        }
    }

    // ─── Compute Timeline Bounds ───
    get timelineBounds() {
        let minDate = null;
        let maxDate = null;
        this.lineItems.forEach(item => {
            if (item.Start_Date__c) {
                const d = new Date(item.Start_Date__c);
                if (!minDate || d < minDate) minDate = d;
            }
            if (item.End_Date__c) {
                const d = new Date(item.End_Date__c);
                if (!maxDate || d > maxDate) maxDate = d;
            }
        });

        // Fallback: quote dates
        if (!minDate && this.quoteData?.Start_Date__c) {
            minDate = new Date(this.quoteData.Start_Date__c);
        }
        if (!maxDate && this.quoteData?.End_Date__c) {
            maxDate = new Date(this.quoteData.End_Date__c);
        }

        // Default: current month ± 6 months
        if (!minDate) minDate = new Date();
        if (!maxDate) maxDate = new Date();

        // Extend 1 month on each side for padding
        const start = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
        const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 1);

        return { start, end };
    }

    get totalMonths() {
        const b = this.timelineBounds;
        return (b.end.getFullYear() - b.start.getFullYear()) * 12 + (b.end.getMonth() - b.start.getMonth());
    }

    get totalChartWidth() {
        return this.totalMonths * MONTH_WIDTH;
    }

    get chartAreaStyle() {
        return `width: ${this.totalChartWidth}px; position: relative;`;
    }

    get monthLabelsStyle() {
        return `width: ${this.totalChartWidth}px;`;
    }

    // ─── Month Columns ───
    get monthColumns() {
        const b = this.timelineBounds;
        const months = [];
        let currentDate = new Date(b.start.getFullYear(), b.start.getMonth(), 1);
        let idx = 0;

        while (currentDate < b.end) {
            const m = currentDate.getMonth();
            const y = currentDate.getFullYear();
            const leftPx = idx * MONTH_WIDTH;
            const showYear = idx === 0 || m === 0; // First column or January

            months.push({
                key: `month-${y}-${m}`,
                label: MONTH_NAMES[m],
                year: String(y),
                showYear: showYear,
                style: `left: ${leftPx}px; width: ${MONTH_WIDTH}px;`,
                gridLineStyle: `left: ${leftPx}px; height: 100%;`
            });

            currentDate = new Date(y, m + 1, 1);
            idx++;
        }
        return months;
    }

    // ─── Build Gantt Rows ───
    get ganttRows() {
        const rows = [];
        const b = this.timelineBounds;

        // Group items by phase
        const phaseItemsMap = new Map();
        const unphasedItems = [];

        // Initialize from phaseOrder
        this.phaseOrder.forEach(p => phaseItemsMap.set(p, []));

        this.lineItems.forEach(item => {
            const phase = item.Phase__c;
            if (!phase || phase === 'Default') {
                unphasedItems.push(item);
            } else {
                if (!phaseItemsMap.has(phase)) {
                    phaseItemsMap.set(phase, []);
                }
                phaseItemsMap.get(phase).push(item);
            }
        });

        // Unphased items grouped under "Default phase" if any
        if (unphasedItems.length > 0) {
            if (!phaseItemsMap.has('Default phase')) {
                phaseItemsMap.set('Default phase', []);
            }
            unphasedItems.forEach(item => phaseItemsMap.get('Default phase').push(item));
        }

        // Build rows
        const phaseNames = [...this.phaseOrder];
        phaseItemsMap.forEach((_, name) => {
            if (!phaseNames.includes(name)) phaseNames.push(name);
        });

        phaseNames.forEach(phaseName => {
            const items = phaseItemsMap.get(phaseName) || [];
            if (items.length === 0 && !this.phaseOrder.includes(phaseName)) return;

            // Phase header row
            rows.push({
                key: `ph-${phaseName}`,
                isPhaseHeader: true,
                name: phaseName
            });

            // Item rows
            items.forEach(item => {
                rows.push(this._buildItemRow(item, b));
            });
        });

        return rows;
    }

    _buildItemRow(item, bounds) {
        const typeDef = TYPE_COLORS[item.Item_Type__c] || TYPE_COLORS['Product'];
        const name = this._getDisplayName(item);
        const hasStart = !!item.Start_Date__c;
        const hasEnd = !!item.End_Date__c;
        const hasBar = hasStart && hasEnd;

        let barStyle = '';
        let barLabel = '';
        let barClass = 'gantt-bar';

        if (hasBar) {
            const startDate = new Date(item.Start_Date__c);
            const endDate = new Date(item.End_Date__c);
            const leftPx = this._dateToPx(startDate, bounds);
            const rightPx = this._dateToPx(endDate, bounds);
            const widthPx = Math.max(rightPx - leftPx, 20); // minimum 20px width

            barStyle = `left: ${leftPx}px; width: ${widthPx}px; background: ${typeDef.bg};`;
            barLabel = name.length > 18 ? name.substring(0, 16) + '…' : name;
        }

        // Duration label
        let durationLabel = '';
        if (hasStart && hasEnd) {
            const startDate = new Date(item.Start_Date__c);
            const endDate = new Date(item.End_Date__c);
            const diffMs = endDate - startDate;
            const diffDays = Math.round(diffMs / 86400000);
            if (diffDays < 30) {
                durationLabel = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
            } else {
                const months = Math.round(diffDays / 30);
                durationLabel = months === 1 ? 'about 1 month' : `${months} months`;
            }
        }

        // Dot class
        let dotClass = 'dot ';
        if (item.Item_Type__c === 'Product') dotClass += 'product-dot';
        else if (item.Item_Type__c === 'Add-on') dotClass += 'addon-dot';
        else dotClass += 'role-dot';

        // Icon for bar
        let barIcon = '';
        if (item.Item_Type__c === 'Resource Role') barIcon = '👤';
        else if (item.Item_Type__c === 'Product') barIcon = '⚙';
        else if (item.Item_Type__c === 'Add-on') barIcon = '➕';

        return {
            key: `item-${item.Id}`,
            isPhaseHeader: false,
            id: item.Id,
            name: name,
            type: item.Item_Type__c,
            durationLabel: durationLabel,
            dotClass: dotClass,
            hasBar: hasBar,
            barClass: barClass,
            barStyle: barStyle,
            barLabel: barLabel,
            barIcon: barIcon,
            // Data for tooltip
            _item: item
        };
    }

    _dateToPx(date, bounds) {
        const startMs = bounds.start.getTime();
        const endMs = bounds.end.getTime();
        const totalMs = endMs - startMs;
        const dateMs = date.getTime() - startMs;
        const ratio = dateMs / totalMs;
        return ratio * this.totalChartWidth;
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

    _formatCurrency(value) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
    }

    // ─── Tooltip ───
    handleBarHover(event) {
        const itemId = event.currentTarget.dataset.id;
        const item = this.lineItems.find(i => i.Id === itemId);
        if (!item) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const containerRect = this.template.querySelector('.timeline-wrapper').getBoundingClientRect();

        this.tooltipX = rect.left - containerRect.left + rect.width / 2;
        this.tooltipY = rect.top - containerRect.top - 6;

        const dateOpts = { month: 'numeric', day: 'numeric', year: 'numeric' };

        this.tooltipData = {
            name: this._getDisplayName(item),
            type: item.Item_Type__c || '-',
            quantity: String(item.Quantity__c || 0),
            unitPrice: this._formatCurrency(item.Unit_Price__c),
            total: this._formatCurrency(item.Net_Total__c),
            discount: (item.Discount_Percent__c || 0) + '%',
            startDate: item.Start_Date__c
                ? new Date(item.Start_Date__c).toLocaleDateString('en-US', dateOpts)
                : '-',
            endDate: item.End_Date__c
                ? new Date(item.End_Date__c).toLocaleDateString('en-US', dateOpts)
                : '-'
        };

        this.tooltipVisible = true;
    }

    handleBarLeave() {
        this.tooltipVisible = false;
    }

    get tooltipStyle() {
        return `left: ${this.tooltipX}px; top: ${this.tooltipY}px;`;
    }

    // Sync left/right scroll vertically
    handleGanttScroll() {
        // Left panel scroll syncs with right panel
        const right = this.template.querySelector('.gantt-right-body');
        const left = this.template.querySelector('.gantt-left-body');
        if (right && left) {
            left.scrollTop = right.scrollTop;
        }
    }
}
