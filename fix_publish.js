const fs = require('fs');

let adminFile = 'force-app/main/default/lwc/adminSettings/adminSettings.js';
let content = fs.readFileSync(adminFile, 'utf-8');

if (!content.includes('CURRENCY_CHANGE_CHANNEL')) {
    content = content.replace(/import {([^}]+)} from 'lwc';/, `import { $1 } from 'lwc';\nimport { publish, MessageContext } from 'lightning/messageService';\nimport CURRENCY_CHANGE_CHANNEL from '@salesforce/messageChannel/CurrencyChange__c';`);
    
    // Add wire directly into class
    content = content.replace(/(export default class AdminSettings extends LightningElement\s*\{)/, `$1\n    @wire(MessageContext)\n    messageContext;`);
    
    // Inject publish after triggerCurrencyConversion
    content = content.replace(/(await triggerCurrencyConversion\(\{ newIsoCode: cur \}\);[\s\S]*?this\.showToast\('[^']+',\s*`Global currency conversion to \$\{cur\} initiated\.[^`]+`[^)]+\);)/, `$1\n            publish(this.messageContext, CURRENCY_CHANGE_CHANNEL, { currencyCode: cur });`);
    
    fs.writeFileSync(adminFile, content, 'utf-8');
    console.log('Fixed publish.');
}
