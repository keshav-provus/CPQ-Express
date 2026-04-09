// Snapshot before conversion
System.debug('=== BEFORE CONVERSION ===');
for (Resource_Role__c r : [SELECT Name, Price__c, Cost__c, CurrencyIsoCode FROM Resource_Role__c LIMIT 3]) {
    System.debug('Role: ' + r.Name + ' | Price: ' + r.Price__c + ' | Currency: ' + r.CurrencyIsoCode);
}
for (Quote_Line_Item__c q : [SELECT Name, Unit_Price__c, CurrencyIsoCode, Quote__r.Name FROM Quote_Line_Item__c LIMIT 3]) {
    System.debug('QLI: ' + q.Name + ' | UnitPrice: ' + q.Unit_Price__c + ' | Currency: ' + q.CurrencyIsoCode + ' | Quote: ' + q.Quote__r.Name);
}
for (Quote__c q : [SELECT Name, Total_Amount__c, CurrencyIsoCode FROM Quote__c WHERE Total_Amount__c > 0 LIMIT 3]) {
    System.debug('Quote: ' + q.Name + ' | Total: ' + q.Total_Amount__c + ' | Currency: ' + q.CurrencyIsoCode);
}

// Trigger conversion to INR
Company_Settings__c s = Company_Settings__c.getOrgDefaults();
s.Default_Currency__c = 'INR';
upsert s;
Database.executeBatch(new CurrencyConverterBatch('INR'), 200);
System.debug('=== CONVERSION TO INR INITIATED ===');
