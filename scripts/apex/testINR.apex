System.debug('=== BEFORE USD->INR ===');
for (Resource_Role__c r : [SELECT Name, Name__c, Price__c, CurrencyIsoCode FROM Resource_Role__c LIMIT 3]) {
    System.debug('Role: ' + r.Name__c + ' | Price: ' + r.Price__c + ' | Cur: ' + r.CurrencyIsoCode);
}
for (Quote_Line_Item__c q : [SELECT Name__c, Unit_Price__c, Resource_Role__c, CurrencyIsoCode FROM Quote_Line_Item__c LIMIT 3]) {
    System.debug('QLI: ' + q.Name__c + ' | UnitPrice: ' + q.Unit_Price__c + ' | RoleID: ' + q.Resource_Role__c + ' | Cur: ' + q.CurrencyIsoCode);
}
for (Quote__c q : [SELECT Name, Total_Amount__c, CurrencyIsoCode FROM Quote__c WHERE Total_Amount__c > 0 LIMIT 3]) {
    System.debug('Quote: ' + q.Name + ' | Total: ' + q.Total_Amount__c + ' | Cur: ' + q.CurrencyIsoCode);
}
// Now trigger the conversion
Company_Settings__c s = Company_Settings__c.getOrgDefaults();
s.Default_Currency__c = 'INR';
upsert s;
Database.executeBatch(new CurrencyConverterBatch('INR'), 200);
System.debug('=== CONVERSION TO INR STARTED ===');
