const fs = require('fs');

let xmlFile = 'force-app/main/default/objects/Quote__c/validationRules/Lock_Non_Draft_Quotes.validationRule-meta.xml';
let xml = fs.readFileSync(xmlFile, 'utf8');

xml = xml.replace(
`  NOT(ISCHANGED(Phase_List__c))
)`,
`  NOT(ISCHANGED(Phase_List__c)),
  NOT(ISCHANGED(CurrencyIsoCode))
)`);

fs.writeFileSync(xmlFile, xml);
console.log('patched');
