const fs = require('fs');

let htmlFile = 'force-app/main/default/lwc/cpqManagerDashboardApp/cpqManagerDashboardApp.html';
let html = fs.readFileSync(htmlFile, 'utf8');

// Replace the layout to fit everything in a single page
html = html.replace(
    /<div class="dashboard-shell">/,
    `<div class="dashboard-shell">\n        <div class="left-col">`
);

// Remove the bottom AI section
html = html.replace(
    /        <!-- ═══ Full Width AI Intelligence \(Bottom\) ═══ -->[\s\S]*?<\/div>\n    <\/div>/,
    `        </div>\n\n        <!-- ═══ AI Assistant (Right Column) ═══ -->\n        <c-cpq-ai-assistant></c-cpq-ai-assistant>\n    </div>`
);

fs.writeFileSync(htmlFile, html);

let cssFile = 'force-app/main/default/lwc/cpqManagerDashboardApp/cpqManagerDashboardApp.css';
let css = fs.readFileSync(cssFile, 'utf8');

// Update dashboard-shell and add left-col
css = css.replace(
    /\.dashboard-shell \{[\s\S]*?\}/,
    `.dashboard-shell {
    max-width: 100%;
    margin: 0;
    padding: 1rem;
    display: grid;
    grid-template-columns: 7fr 3fr;
    gap: 1rem;
    height: calc(100vh - 100px);
    box-sizing: border-box;
    overflow: hidden;
}

.left-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: auto;
    padding-right: 0.5rem;
}`
);

// Remove AI Panel styles
css = css.replace(
    /\/\* ─── AI Panel \(dark full width\) ─── \*\/[\s\S]*?\/\* ─── Right Column ─── \*\//,
    `/* ─── Right Column ─── */`
);

// We need to style c-cpq-ai-assistant just like in sales rep dash if they did it there
css += `\n
c-cpq-ai-assistant {
    display: flex;
    flex-direction: column;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
`;

fs.writeFileSync(cssFile, css);
console.log("Patched manager dash!");
