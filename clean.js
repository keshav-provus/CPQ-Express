const fs = require('fs');

const cleanFile = (file) => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove tabs
    content = content.replace(/ *<tab>Categories__c<\/tab>\r?\n?/g, '');
    content = content.replace(/ *<tabs>Categories__c<\/tabs>\r?\n?/g, '');
    
    // Remove objectPermissions for Categories__c
    content = content.replace(/ *<objectPermissions>[\s\S]*?<object>Categories__c<\/object>[\s\S]*?<\/objectPermissions>\r?\n?/g, '');
    
    // Remove fieldPermissions for Categories__c
    content = content.replace(/ *<fieldPermissions>[\s\S]*?<field>Categories__c\.[^<]+<\/field>[\s\S]*?<\/fieldPermissions>\r?\n?/g, '');

    // Remove fieldPermissions for Product__c.Category__c
    content = content.replace(/ *<fieldPermissions>[\s\S]*?<field>Product__c.Category__c<\/field>[\s\S]*?<\/fieldPermissions>\r?\n?/g, '');

    // Remove object reference
    content = content.replace(/ *<object>Categories__c<\/object>\r?\n?/g, '');

    fs.writeFileSync(file, content);
};

const searchDir = (dir) => {
    fs.readdirSync(dir, {withFileTypes:true}).forEach(dirent => {
        const fullPath = dir + '/' + dirent.name;
        if(dirent.isDirectory()) {
            searchDir(fullPath);
        } else if (fullPath.endsWith('.xml') && fullPath.indexOf('destructiveChanges.xml') === -1) {
            cleanFile(fullPath);
        }
    });
};

searchDir('force-app/main/default');
console.log('Cleanup finished!');
