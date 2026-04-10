import { LightningElement, api, track } from 'lwc';

export default class CpqManagerKPIs extends LightningElement {
    @api kpiData = {};

    get formattedRevenue() {
        const rev = this.kpiData?.totalRevenue || 0;
        if (rev >= 1000000) return '$' + (rev / 1000000).toFixed(1) + 'M';
        if (rev >= 1000) return '$' + (rev / 1000).toFixed(0) + 'k';
        return '$' + rev;
    }

    get revenueTrend() { return this.kpiData?.revenueTrend || 12; }
    get activeQuotes() { return this.kpiData?.activeQuotes || 0; }
    get velocityDays() { return this.kpiData?.velocityDays || '4.2'; }

    get approvalRate() {
        const total = this.kpiData?.totalQuotes || 1;
        const approved = this.kpiData?.approvedQuotes || 0;
        return total > 0 ? Math.round((approved / total) * 100) : 0;
    }

    get approvalProgressStyle() {
        return `width: ${this.approvalRate}%`;
    }

    get formattedAvgValue() {
        const val = this.kpiData?.avgQuoteValue || 0;
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
        return '$' + val;
    }

    get avgTrend() { return this.kpiData?.avgTrend || 6; }

    get formattedWinRate() {
        return this.kpiData?.winRate || 84;
    }

    get targetWinRate() { return 80; }
    get winRateDelta() { return this.kpiData?.winRateDelta || 8; }

    get waffleBlocks() {
        const winRate = this.formattedWinRate;
        const filled = Math.round(winRate / 100 * 12);
        const blocks = [];
        for (let i = 0; i < 12; i++) {
            blocks.push({
                key: 'w' + i,
                className: i < filled ? 'waffle-block waffle-filled' : 'waffle-block waffle-empty'
            });
        }
        return blocks;
    }
}