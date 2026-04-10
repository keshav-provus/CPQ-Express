import { LightningElement, api, wire, track } from 'lwc';
import getProductById from '@salesforce/apex/ProductController.getProductById';
import getProductUsage from '@salesforce/apex/ProductController.getProductUsage';
import getProductDiscountTiers from '@salesforce/apex/ProductController.getProductDiscountTiers';
import getProductAddOns from '@salesforce/apex/ProductController.getProductAddOns';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqProductRecordPage extends LightningElement {
    @track currencyCode = 'USD';
    @api recordId;
    
    @track searchTerm = '';
    
    @track product;
    @track discountTiers = [];
    @track addOns = [];
    @track allQuotes = []; 
    @track filteredQuotes = [];
    
    @track kpiRevenue = 0;
    @track kpiActiveQuotes = 0;
    @track kpiDuration = 'N/A';
    @track kpiPeakUsage = 'N/A';

    @track isDropdownOpen = false;
    @track uniqueAccounts = [];
    @track filteredAccountOptions = [];

    // Gantt color palette
    ganttColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];

    @wire(getDefaultCurrency)
    wiredCurrency({ data }) {
        if (data) this.currencyCode = data;
    }

    @wire(getProductById, { productId: '$recordId' })
    wiredProduct({ data }) {
        if (data) this.product = data;
    }

    @wire(getProductDiscountTiers, { productId: '$recordId' })
    wiredTiers({ data }) {
        if (data) this.discountTiers = data;
    }

    @wire(getProductAddOns, { productId: '$recordId' })
    wiredAddons({ data }) {
        if (data) this.addOns = data;
    }

    @wire(getProductUsage, { productId: '$recordId' })
    wiredUsage({ data }) {
        if (data) {
            this.allQuotes = data.map((item, i) => ({
                id: item.Quote__r ? item.Quote__r.Name : `Q-${i}`,
                accountName: (item.Quote__r && item.Quote__r.Account__r) ? item.Quote__r.Account__r.Name : 'Unknown',
                start: new Date(item.Start_Date__c),
                end: new Date(item.End_Date__c),
                revenue: item.Net_Total__c || 0,
                color: this.ganttColors[i % this.ganttColors.length]
            }));
            this.filteredQuotes = [...this.allQuotes];
            this.uniqueAccounts = [...new Set(this.allQuotes.map(q => q.accountName))].sort();
            this.filteredAccountOptions = [...this.uniqueAccounts];
            this.calculateKPIs();
        }
    }

    renderedCallback() {
        this.drawGantt();
    }

    // ─── Search / Filter ─────────────────────────────────────────────────

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        const term = this.searchTerm.toLowerCase();
        this.filteredAccountOptions = this.uniqueAccounts.filter(acc => acc.toLowerCase().includes(term));
        this.isDropdownOpen = true;
    }

    handleSearchClick() {
        this.isDropdownOpen = true;
    }

    handleSearchBlur() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.isDropdownOpen = false; }, 200);
    }

    handleAccountSelect(event) {
        this.searchTerm = event.currentTarget.dataset.val;
        this.isDropdownOpen = false;
        this.handleSearchSubmit();
    }

    handleSearchSubmit() {
        if (!this.searchTerm) {
            this.filteredQuotes = [...this.allQuotes];
        } else {
            const term = this.searchTerm.toLowerCase();
            this.filteredQuotes = this.allQuotes.filter(q => q.accountName.toLowerCase().includes(term));
        }
        this.isDropdownOpen = false;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => { this.drawGantt(); }, 0);
    }

    // ─── KPIs ────────────────────────────────────────────────────────────

    calculateKPIs() {
        if (!this.allQuotes.length) return;

        let totalRev = 0;
        let totalDuration = 0;
        const usageByMonth = {};

        this.allQuotes.forEach(q => {
            totalRev += q.revenue;
            const months = (q.end - q.start) / (1000 * 60 * 60 * 24 * 30.41);
            totalDuration += months;

            let curr = new Date(q.start);
            while (curr <= q.end) {
                const key = curr.toLocaleString('default', { month: 'short', year: 'numeric' });
                usageByMonth[key] = (usageByMonth[key] || 0) + 1;
                curr.setMonth(curr.getMonth() + 1);
            }
        });

        this.kpiRevenue = totalRev;
        this.kpiActiveQuotes = this.allQuotes.length;
        this.kpiDuration = (totalDuration / this.allQuotes.length).toFixed(1) + ' mo';

        let peak = 'N/A';
        let max = 0;
        for (const month in usageByMonth) {
            if (usageByMonth[month] > max) {
                max = usageByMonth[month];
                peak = month;
            }
        }
        this.kpiPeakUsage = peak;
    }

    get formattedKpiRevenue() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, minimumFractionDigits: 0 }).format(this.kpiRevenue);
    }

    // ─── GANTT CHART ─────────────────────────────────────────────────────

    drawGantt() {
        const wrap = this.template.querySelector('.gantt-container');
        if (!wrap) return;

        const quotes = this.filteredQuotes;
        const W = wrap.clientWidth || 700;

        if (quotes.length === 0) {
            wrap.innerHTML = `<div style="padding:2rem 0;text-align:center;color:#94a3b8;font-size:0.85rem;">No quotes match this filter.</div>`;
            const lg = this.template.querySelector('.legend-row');
            if (lg) lg.innerHTML = '';
            return;
        }

        // ── Dimensions ──
        const ROW_HEIGHT = 36;
        const ROW_GAP = 6;
        const LABEL_WIDTH = 140;
        const PAD_TOP = 30;
        const PAD_BOTTOM = 30;
        const PAD_RIGHT = 16;

        const chartW = W - LABEL_WIDTH - PAD_RIGHT;
        const chartH = quotes.length * (ROW_HEIGHT + ROW_GAP) + PAD_TOP + PAD_BOTTOM;

        // ── Time range ──
        let minDate = new Date(Math.min(...quotes.map(q => q.start)));
        let maxDate = new Date(Math.max(...quotes.map(q => q.end)));
        // Add padding
        minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);
        const timeRange = maxDate - minDate;
        const tx = (d) => LABEL_WIDTH + ((d - minDate) / timeRange) * chartW;

        // ── Build SVG ──
        let svg = `<svg width="${W}" height="${chartH}" viewBox="0 0 ${W} ${chartH}" style="display:block;">`;

        // Background
        svg += `<rect width="${W}" height="${chartH}" fill="#fafbfc" rx="8"/>`;

        // ── Month grid lines + labels ──
        const months = [];
        let cur = new Date(minDate);
        while (cur <= maxDate) {
            months.push(new Date(cur));
            cur.setMonth(cur.getMonth() + 1);
        }
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        months.forEach(m => {
            const x = tx(m);
            if (x >= LABEL_WIDTH && x <= LABEL_WIDTH + chartW) {
                // Grid line
                svg += `<line x1="${x}" y1="${PAD_TOP}" x2="${x}" y2="${chartH - PAD_BOTTOM}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="4,3"/>`;
                // Month label at top
                svg += `<text x="${x + 4}" y="${PAD_TOP - 8}" fill="#94a3b8" font-size="10" font-weight="500">${monthNames[m.getMonth()]} '${String(m.getFullYear()).slice(2)}</text>`;
            }
        });

        // ── Row bars ──
        const sorted = [...quotes].sort((a, b) => a.start - b.start);
        sorted.forEach((q, i) => {
            const y = PAD_TOP + i * (ROW_HEIGHT + ROW_GAP);
            const barY = y + 4;
            const barH = ROW_HEIGHT - 8;

            // Row background stripe
            if (i % 2 === 0) {
                svg += `<rect x="0" y="${y}" width="${W}" height="${ROW_HEIGHT}" fill="#ffffff" rx="0"/>`;
            }

            // Quote label (left side)
            const label = q.id.length > 16 ? q.id.substring(0, 14) + '…' : q.id;
            svg += `<text x="${LABEL_WIDTH - 12}" y="${y + ROW_HEIGHT / 2 + 4}" text-anchor="end" fill="#334155" font-size="11" font-weight="600">${this.escapeHtml(label)}</text>`;

            // Gantt bar
            const x1 = tx(q.start);
            const x2 = tx(q.end);
            const barW = Math.max(6, x2 - x1);

            svg += `<rect x="${x1}" y="${barY}" width="${barW}" height="${barH}" rx="5" fill="${q.color}" opacity="0.9" data-id="${q.id}" style="cursor:pointer;"/>`;

            // Revenue label inside bar (if wide enough)
            if (barW > 90) {
                const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(q.revenue);
                svg += `<text x="${x1 + barW / 2}" y="${barY + barH / 2 + 4}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="600" pointer-events="none">${fmt}</text>`;
            }

            // Account name after bar
            const afterX = x1 + barW + 6;
            if (afterX < W - 80) {
                const accLabel = q.accountName.length > 20 ? q.accountName.substring(0, 18) + '…' : q.accountName;
                svg += `<text x="${afterX}" y="${y + ROW_HEIGHT / 2 + 4}" fill="#94a3b8" font-size="10" font-weight="400">${this.escapeHtml(accLabel)}</text>`;
            }
        });

        // ── "Today" marker ──
        const today = new Date();
        if (today >= minDate && today <= maxDate) {
            const todayX = tx(today);
            svg += `<line x1="${todayX}" y1="${PAD_TOP - 4}" x2="${todayX}" y2="${chartH - PAD_BOTTOM}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,2"/>`;
            svg += `<text x="${todayX}" y="${PAD_TOP - 10}" text-anchor="middle" fill="#ef4444" font-size="9" font-weight="700">TODAY</text>`;
        }

        svg += `</svg>`;
        wrap.innerHTML = svg;

        // ── Legend ──
        const lg = this.template.querySelector('.legend-row');
        if (lg) {
            let lgHtml = '';
            sorted.forEach(q => {
                const durMonths = Math.round((q.end - q.start) / (1000 * 60 * 60 * 24 * 30.4));
                const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(q.revenue);
                lgHtml += `<div class="legend-item">
                    <span class="legend-swatch" style="background:${q.color}"></span>
                    <span><b style="color:#334155">${this.escapeHtml(q.id)}</b> · ${this.escapeHtml(q.accountName)} · ${fmt} · ${durMonths}mo</span>
                </div>`;
            });
            lg.innerHTML = lgHtml;
        }

        // ── Tooltips ──
        const rects = wrap.querySelectorAll('rect[data-id]');
        rects.forEach(rect => {
            rect.addEventListener('mouseenter', this.handleShowTT.bind(this));
            rect.addEventListener('mouseleave', this.handleHideTT.bind(this));
            rect.addEventListener('mousemove', this.handleMoveTT.bind(this));
        });
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    handleShowTT(e) {
        const qid = e.target.getAttribute('data-id');
        const q = this.allQuotes.find(x => x.id === qid);
        if (!q) return;
        const tt = this.template.querySelector('.tooltip-box');
        const dur = Math.round((q.end - q.start) / (86400000 * 30.4));
        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(q.revenue);
        const startStr = q.start.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        const endStr = q.end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

        tt.innerHTML = `<div class="tt-name">${this.escapeHtml(q.id)} · ${this.escapeHtml(q.accountName)}</div>
          <div class="tt-row"><span>Revenue</span><span class="tt-val">${fmt}</span></div>
          <div class="tt-row"><span>Duration</span><span class="tt-val">~${dur} months</span></div>
          <div class="tt-row"><span>Start</span><span class="tt-val">${startStr}</span></div>
          <div class="tt-row"><span>End</span><span class="tt-val">${endStr}</span></div>`;
        tt.style.display = 'block';
        tt.style.left = Math.min(e.clientX + 12, window.innerWidth - 260) + 'px';
        tt.style.top = (e.clientY - 10) + 'px';
    }

    handleMoveTT(e) {
        const tt = this.template.querySelector('.tooltip-box');
        if (tt) {
            tt.style.left = Math.min(e.clientX + 12, window.innerWidth - 260) + 'px';
            tt.style.top = (e.clientY - 10) + 'px';
        }
    }

    handleHideTT() {
        const tt = this.template.querySelector('.tooltip-box');
        if (tt) tt.style.display = 'none';
    }
}
