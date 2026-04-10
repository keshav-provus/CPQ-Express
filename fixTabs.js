const fs = require('fs');

const fixFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove empty tabVisibilities
    content = content.replace(/ *<tabVisibilities>\s*<visibility>[\w]+<\/visibility>\s*<\/tabVisibilities>\r?\n?/g, '');
    
    fs.writeFileSync(file, content);
};

['force-app/main/default/profiles/Admin.profile-meta.xml', 
 'force-app/main/default/profiles/Sales_Manager.profile-meta.xml', 
 'force-app/main/default/profiles/Sales_Rep.profile-meta.xml'].forEach(fixFile);
console.log('Fixed profiles.');
