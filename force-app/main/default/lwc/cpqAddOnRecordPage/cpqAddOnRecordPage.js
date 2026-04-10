import { LightningElement, api, wire, track } from 'lwc';
import getAddOnById from '@salesforce/apex/ProductController.getAddOnById';
import getAddOnUsage from '@salesforce/apex/ProductController.getAddOnUsage';
import getDefaultCurrency from '@salesforce/apex/AdminSettingsController.getDefaultCurrency';

export default class CpqAddOnRecordPage extends LightningElement {
    @track currencyCode = 'USD';

        @api recordId;
    
    @track searchTerm = '';
    
    @track item;
    @track allQuotes = []; 
    @track filteredQuotes = [];
    
    @track kpiRevenue = 0;
    @track kpiActiveQuotes = 0;
    @track kpiDuration = 'N/A';
    @track kpiPeakUsage = 'N/A';

    @track isDropdownOpen = false;
    @track uniqueAccounts = [];
    @track filteredAccountOptions = [];

    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    gridColor = this.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    textColor = this.isDark ? '#9B99A8' : '#777587';

    @wire(getAddOnById, { addOnId: '$recordId' })
    wiredItem({ data }) {
        if (data) Object.assign(this, { item: data });
    }

    @wire(getAddOnUsage, { addOnId: '$recordId' })
    wiredUsage({ data }) {
        if (data) {
            const colors = ['#004880', '#1B6D24', '#2E4A57', '#0060A8', '#88D982'];
            this.allQuotes = data.map((qItem, i) => ({
                id: qItem.Quote__r ? qItem.Quote__r.Name : `Q-${i}`,
                accountName: (qItem.Quote__r && qItem.Quote__r.Account__r) ? qItem.Quote__r.Account__r.Name : 'Unknown',
                start: new Date(qItem.Start_Date__c),
                end: new Date(qItem.End_Date__c),
                revenue: qItem.Net_Total__c || 0,
                color: colors[i % colors.length]
            }));
            this.filteredQuotes = [...this.allQuotes];
            this.uniqueAccounts = [...new Set(this.allQuotes.map(q => q.accountName))].sort();
            this.filteredAccountOptions = [...this.uniqueAccounts];
            this.calculateKPIs();
        }
    }

    renderedCallback() {
        this.drawGantt();
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    disconnectedCallback() {
        this.fetchCurrency();
        window.removeEventListener('resize', this.handleResize.bind(this));
    }

    fetchCurrency() {
        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));
    }

    handleResize() {
        this.drawGantt();
    }

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
        setTimeout(() => {
            this.isDropdownOpen = false;
        }, 200);
    }

    handleAccountSelect(event) {
        this.searchTerm = event.currentTarget.dataset.val;
        this.isDropdownOpen = false;
        this.handleSearchSubmit();
    }

    get dropdownClasses() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.isDropdownOpen ? 'slds-is-open' : ''}`;
    }

    handleSearchSubmit() {
        if (!this.searchTerm) {
            this.filteredQuotes = [...this.allQuotes];
        } else {
            const term = this.searchTerm.toLowerCase();
            this.filteredQuotes = this.allQuotes.filter(q => q.accountName.toLowerCase().includes(term));
        }
        
        this.isDropdownOpen = false;
        setTimeout(() => {
            this.drawGantt();
        }, 0);
    }

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

    drawGantt() {
        const wrap = this.template.querySelector('.timeline-wrap');
        if (!wrap) return;
        
        const W = wrap.clientWidth || 700;
        const quotes = this.filteredQuotes;
        let html = `<svg width="${W}" height="200" viewBox="0 0 ${W} 200">`;
        
        if (quotes.length === 0) {
            html += `<text x="20" y="40" fill="${this.textColor}" font-size="13">No quotes match this filter.</text></svg>`;
            wrap.innerHTML = html;
            return;
        }

        const padL = 52, padR = 24, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = 200;
        const H = chartH + padT + padB;
        html = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;

        let minDate = new Date(Math.min(...quotes.map(q => q.start)));
        let maxDate = new Date(Math.max(...quotes.map(q => q.end)));
        minDate.setMonth(minDate.getMonth() - 1);
        maxDate.setMonth(maxDate.getMonth() + 1);

        const timeRange = maxDate - minDate;
        const tx = (d) => padL + ((d - minDate) / timeRange) * chartW;
        
        const yTicks = [0, 25, 50, 75, 100];
        const ty = (pct) => padT + chartH - (pct / 100) * chartH;

        yTicks.forEach(pct => {
            const y = ty(pct);
            html += `<line x1="${padL}" y1="${y}" x2="${padL + chartW}" y2="${y}" stroke="${this.gridColor}" stroke-width="1"/>`;
            html += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="${this.textColor}" font-size="10">${pct}%</text>`;
        });

        const months = [];
        let cur = new Date(minDate);
        cur.setDate(1);
        while (cur <= maxDate) {
            months.push(new Date(cur));
            cur.setMonth(cur.getMonth() + 1);
        }

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        months.forEach(m => {
            const x = tx(m);
            if (x >= padL && x <= padL + chartW) {
                html += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + chartH}" stroke="${this.gridColor}" stroke-width="0.5"/>`;
                html += `<text x="${x}" y="${padT + chartH + 14}" text-anchor="middle" fill="${this.textColor}" font-size="10">${monthNames[m.getMonth()]} ${String(m.getFullYear()).slice(2)}</text>`;
            }
        });

        html += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="${this.textColor}" stroke-width="0.5"/>`;
        html += `<line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="${this.textColor}" stroke-width="0.5"/>`;

        const totalRev = this.allQuotes.reduce((s, q) => s + q.revenue, 0);
        const sorted = [...quotes].sort((a, b) => b.revenue - a.revenue);
        const maxRevPct = sorted[0] ? (sorted[0].revenue / totalRev) * 100 : 100;

        const BAND_HEIGHT = 26;
        
        sorted.forEach((q) => {
            const pct = (q.revenue / totalRev) * 100;
            const barH = Math.max(8, Math.round((pct / maxRevPct) * BAND_HEIGHT * 1.8));
            const x1 = tx(q.start);
            const x2 = tx(q.end);
            const bW = Math.max(30, x2 - x1);
            const y = ty(pct) - barH / 2;

            html += `<rect x="${x1}" y="${y}" width="${bW}" height="${barH}" rx="4" fill="${q.color}" opacity="0.85" 
                      data-id="${q.id}" style="cursor:pointer;" />`;

            if (bW > 80) {
                const labelX = x1 + bW / 2;
                const labelY = y + barH / 2 + 4;
                html += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#fff" font-size="10" font-weight="500" pointer-events="none">${q.id}</text>`;
            }
        });

        html += `<text x="${padL}" y="13" fill="${this.textColor}" font-size="10">% of total revenue</text>`;
        html += `</svg>`;
        
        wrap.innerHTML = html;

        const lg = this.template.querySelector('.legend-row');
        if (lg) {
            let lgHtml = '';
            sorted.forEach(q => {
                const pct = ((q.revenue / totalRev) * 100).toFixed(1);
                lgHtml += `<div class="legend-item">
                     <span class="legend-swatch" style="background:${q.color}"></span>
                     <span><b style="color:var(--color-on-surface)">${q.id}</b> · ${q.accountName} · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(q.revenue)} (${pct}%)</span>
                     </div>`;
            });
            lg.innerHTML = lgHtml;
        }

        const rects = wrap.querySelectorAll('rect');
        rects.forEach(rect => {
            rect.addEventListener('mouseenter', this.handleShowTT.bind(this));
            rect.addEventListener('mouseleave', this.handleHideTT.bind(this));
            rect.addEventListener('mousemove', this.handleMoveTT.bind(this));
        });
    }

    handleShowTT(e) {
        const qid = e.target.getAttribute('data-id');
        const q = this.allQuotes.find(x => x.id === qid);
        if(!q) return;
        const tt = this.template.querySelector('.tooltip-box');
        const totalRev = this.allQuotes.reduce((s,x)=>s+x.revenue,0);
        const pct = ((q.revenue/totalRev)*100).toFixed(1);
        const dur = Math.round((q.end-q.start)/(86400000*30.4));
        
        tt.innerHTML = `<div class="tt-name">${q.id} · ${q.accountName}</div>
          <div class="tt-row"><span>Revenue</span><span class="tt-val">${new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(q.revenue)}</span></div>
          <div class="tt-row"><span>% of total</span><span class="tt-val">${pct}%</span></div>
          <div class="tt-row"><span>Duration</span><span class="tt-val">~${dur} months</span></div>
          <div class="tt-row"><span>Start</span><span class="tt-val">${q.start.toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</span></div>
          <div class="tt-row"><span>End</span><span class="tt-val">${q.end.toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</span></div>`;
        tt.style.display = 'block';
        tt.style.left = Math.min(e.clientX + 12, window.innerWidth - 220) + 'px';
        tt.style.top = (e.clientY - 10) + 'px';
    }

    handleMoveTT(e) {
        const tt = this.template.querySelector('.tooltip-box');
        if (tt) {
            tt.style.left = Math.min(e.clientX + 12, window.innerWidth - 220) + 'px';
            tt.style.top = (e.clientY - 10) + 'px';
        }
    }

    handleHideTT() {
        const tt = this.template.querySelector('.tooltip-box');
        if (tt) tt.style.display = 'none';
    }
}
