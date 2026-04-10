const fs = require('fs');

let html = fs.readFileSync('force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.html', 'utf8');

// Find start of "<!-- AI Assistant Panel -->"
let startIdx = html.indexOf('<!-- AI Assistant Panel -->');
// Find end of its div wrapper
let endIdx = html.indexOf('</section>', startIdx);

// The div ends just before </section> 
// Let's replace the whole div.ai-panel
let newContent = '<!-- AI Assistant Panel -->\n            <c-cpq-ai-assistant></c-cpq-ai-assistant>\n            \n        ';

html = html.substring(0, startIdx) + newContent + html.substring(endIdx);

fs.writeFileSync('force-app/main/default/lwc/cpqSalesRepDashboardApp/cpqSalesRepDashboardApp.html', html);
console.log('HTML patch done');
