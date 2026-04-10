const fs = require('fs');
const glob = require('glob');

const messageChannelImport = `import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';
`;

const contextWire = `
    @wire(MessageContext)
    messageContext;
`;

const connectedCallbackAddition = `
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                CURRENCY_CHANGE_CHANNEL,
                (message) => {
                    this.handleCurrencyChange(message);
                }
            );
        }
`;

const customFunctions = `
    disconnectedCallback() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }

    handleCurrencyChange(message) {
        if(message && message.currencyCode) {
            this.currencyCode = message.currencyCode;
            if(this.refreshData) {
                this.refreshData();
            }
        }
    }
`;

const files = [
    'force-app/main/default/lwc/cpqManagerKPIs/cpqManagerKPIs.js',
    'force-app/main/default/lwc/cpqActionItems/cpqActionItems.js',
    'force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.js',
    'force-app/main/default/lwc/cpqPendingQuotes/cpqPendingQuotes.js',
    'force-app/main/default/lwc/myRecentQuotes/myRecentQuotes.js',
    'force-app/main/default/lwc/cpqQuotePricingAnalytics/cpqQuotePricingAnalytics.js',
    'force-app/main/default/lwc/cpqMyTopTransactions/cpqMyTopTransactions.js',
    'force-app/main/default/lwc/cpqTopTransactions/cpqTopTransactions.js',
    'force-app/main/default/lwc/teamQuotesPipeline/teamQuotesPipeline.js',
    'force-app/main/default/lwc/cpqWeeklyPipelineChart/cpqWeeklyPipelineChart.js',
    'force-app/main/default/lwc/cpqMyWeeklyPipelineChart/cpqMyWeeklyPipelineChart.js'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');

    if(!content.includes('CURRENCY_CHANGE_CHANNEL')) {
        // inject imports
        content = content.replace(/import {([^}]+)} from 'lwc';/, `import { $1 } from 'lwc';\n${messageChannelImport}`);

        // Make MessageContext available in LWC imports if not there
        if(!content.includes('MessageContext')) {
            // Already handled by substituting complete import line above
        }

        // inject properties inside class
        content = content.replace(/(export default class \w+ extends.*?[^{]*\{)/, `$1${contextWire}`);

        // inject into connectedCallback
        if(content.includes('connectedCallback() {')) {
            content = content.replace(/(connectedCallback\(\)\s*\{)/, `$1${connectedCallbackAddition}`);
        }
        
        // Add additional methods
        content = content.replace(/}$/, `${customFunctions}\n}`);

        fs.writeFileSync(file, content, 'utf-8');
        console.log(`Updated LMS to ${file}`);
    }
});
