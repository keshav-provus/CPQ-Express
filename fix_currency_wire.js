const fs = require('fs');
const glob = require('glob');

const files = glob.sync('force-app/main/default/lwc/**/*.js');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    let original = content;

    // Check if it imports getDefaultCurrency
    if (content.includes('getDefaultCurrency')) {
        // Remove the @wire(getDefaultCurrency)... block
        content = content.replace(/@wire\(getDefaultCurrency\)\s*\n\s*wiredDefaultCurrency\s*\(\{\s*data\s*,?\s*error\s*\}\)\s*\{[\s\S]*?(?=\n\s*(?:@|get|async|[a-zA-Z]+\s*\())/, '');
        content = content.replace(/@wire\(getDefaultCurrency\)\s*\n\s*wiredDefaultCurrency\s*\(\{\s*data\s*\}\)\s*\{[^}]+\}\s*\n/, '');
        
        // Ensure connectedCallback exists
        if (!content.includes('connectedCallback()')) {
            // inject basic connectedCallback before the first function or getter
            // Actually, we can use a simpler approach:
            // Just append it after `export default class ... {`
            content = content.replace(/(export default class \w+ extends.*?\{)/, `$1\n    connectedCallback() {\n        this.fetchCurrency();\n    }\n\n    fetchCurrency() {\n        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));\n    }\n`);
        } else {
            // It has connectedCallback
            // inject `this.fetchCurrency();` into connectedCallback
            content = content.replace(/(connectedCallback\(\)\s*\{)/, `$1\n        this.fetchCurrency();`);
            // inject fetchCurrency function
            content = content.replace(/(connectedCallback\(\)\s*\{[\s\S]*?\})/, `$1\n\n    fetchCurrency() {\n        getDefaultCurrency().then(res => { this.currencyCode = res; }).catch(err => console.error(err));\n    }`);
        }
        
        if (original !== content) {
            fs.writeFileSync(file, content, 'utf-8');
            console.log('Fixed', file);
        }
    }
});
