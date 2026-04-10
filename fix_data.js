const fs = require('fs');

const files = [
 'force-app/main/default/lwc/cpqResourceRoleRecordPage/cpqResourceRoleRecordPage.js',
 'force-app/main/default/lwc/cpqAddOnRecordPage/cpqAddOnRecordPage.js',
 'force-app/main/default/lwc/cpqProductRecordPage/cpqProductRecordPage.js'
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    
    // Add safe checks around dates
    content = content.replace(/let minDate = new Date\(Math.min\(\.\.\.quotes\.map\(q => q\.start\)\)\);/g, 
        `const validStarts = quotes.map(q => q.start).filter(d => !isNaN(d));
        let minDate = validStarts.length ? new Date(Math.min(...validStarts)) : new Date();`);
        
    content = content.replace(/let maxDate = new Date\(Math.max\(\.\.\.quotes\.map\(q => q\.end\)\)\);/g, 
        `const validEnds = quotes.map(q => q.end).filter(d => !isNaN(d));
        let maxDate = validEnds.length ? new Date(Math.max(...validEnds)) : new Date(minDate.getFullYear(), minDate.getMonth() + 1, 1);`);
        
    fs.writeFileSync(f, content);
});
console.log("Safe date checks added to drawGantt.");
