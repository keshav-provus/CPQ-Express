const fs = require('fs');
const glob = require('glob');

const layoutAssignment = `
    <layoutAssignments>
        <layout>Opportunity-Opportunity Layout</layout>
    </layoutAssignments>`;

const files = fs.readdirSync('force-app/main/default/profiles').filter(f => f.endsWith('.profile-meta.xml'));
files.forEach(file => {
    const path = `force-app/main/default/profiles/${file}`;
    let content = fs.readFileSync(path, 'utf8');
    
    if (content.indexOf('<layout>Opportunity-Opportunity Layout</layout>') === -1) {
        // Insert it before the first <layoutAssignments> or just before </Profile>
        if (content.indexOf('<layoutAssignments>') !== -1) {
            content = content.replace(/<layoutAssignments>/, layoutAssignment.trim() + '\n    <layoutAssignments>');
        } else {
            content = content.replace(/<\/Profile>/, layoutAssignment.trim() + '\n</Profile>');
        }
        fs.writeFileSync(path, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
