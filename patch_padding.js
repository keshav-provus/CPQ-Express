const fs = require('fs');

let cssFile = 'force-app/main/default/lwc/cpqManagerDashboardApp/cpqManagerDashboardApp.css';
let css = fs.readFileSync(cssFile, 'utf8');

css = css.replace(/gap: 1.5rem;/g, 'gap: 0.75rem;');
css = css.replace(/gap: 2rem;/g, 'gap: 1rem;');
css = css.replace(/padding: 1rem;/g, 'padding: 0.5rem;');
css = css.replace(/margin-bottom: 2rem;/g, 'margin-bottom: 1rem;');
css = css.replace(/gap: 1rem;/g, 'gap: 0.75rem;');
// Revert grid gap back to a reasonable amount if it got caught
// Actually let's just do it manually with regexes on specific classes to be safer

css = css.replace(
/\.dashboard-shell \{[^}]*\}/,
`.dashboard-shell {
    max-width: 100%;
    margin: 0;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: 7fr 3fr;
    gap: 0.75rem;
    height: calc(100vh - 100px);
    box-sizing: border-box;
    overflow: hidden;
}`
);

css = css.replace(
/\.left-col \{[^}]*\}/,
`.left-col {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    padding-right: 0.25rem;
}`
);

css = css.replace(
/\.kpi-section \{[^}]*\}/,
`.kpi-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}`
);

css = css.replace(
/\.grid-2col \{[^}]*\}/,
`.grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    align-items: start;
    margin-bottom: 0.75rem;
}`
);

css = css.replace(
/\.col-right \{[^}]*\}/,
`.col-right {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}`
);

css = css.replace(
/\.title-row \{[^}]*\}/,
`.title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
}`
);

fs.writeFileSync(cssFile, css);
console.log('Padding patched');
