const fs = require('fs');

const rawHTML = fs.readFileSync('force-app/main/default/lwc/cpqApprovalHistory/product.html', 'utf8');

// Extract the <main>...</main> section
let mainContentMatch = rawHTML.match(/<main[^>]*>([\s\S]*?)<\/main>/);
if (!mainContentMatch) {
    console.error("Main not found");
    process.exit(1);
}
let mainContent = mainContentMatch[1];
fs.writeFileSync('main_content.html', mainContent);
console.log("main_content.html generated");
