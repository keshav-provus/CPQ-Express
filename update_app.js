const fs = require('fs');
let appPath = 'force-app/main/default/applications/CPQ_Express.app-meta.xml';
let xml = fs.readFileSync(appPath, 'utf-8');
if (xml.indexOf('<tabs>Sales_Rep_Dashboard</tabs>') === -1) {
    xml = xml.replace('</CustomApplication>', '    <tabs>Sales_Rep_Dashboard</tabs>\n</CustomApplication>');
    fs.writeFileSync(appPath, xml);
    console.log('App updated with Sales_Rep_Dashboard tab');
} else {
    console.log('App already has it');
}
