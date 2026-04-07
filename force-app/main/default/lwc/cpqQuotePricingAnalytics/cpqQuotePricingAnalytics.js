import { LightningElement, api } from 'lwc';

export default class CpqQuotePricingAnalytics extends LightningElement {
    @api recordId;
    @api competitiveMatch = 92;
    @api historicalAverage = '$39,400.00';
}
