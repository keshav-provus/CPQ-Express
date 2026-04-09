System.debug('=== AFTER CONVERSION ===');
for (Resource_Role__c r : [SELECT Name, Price__c, Cost__c, CurrencyIsoCode FROM Resource_Role__c LIMIT 3]) {
    System.debug('Role: ' + r.Name + ' | Price: ' + r.Price__c + ' | Currency: ' + r.CurrencyIsoCode);
}
for (Quote_Line_Item__c q : [SELECT Name, Unit_Price__c, CurrencyIsoCode, Quote__r.Name, Quote__r.CurrencyIsoCode FROM Quote_Line_Item__c LIMIT 3]) {
    System.debug('QLI: ' + q.Name + ' | UnitPrice: ' + q.Unit_Price__c + ' | QLI_Cur: ' + q.CurrencyIsoCode + ' | Quote: ' + q.Quote__r.Name + ' | Q_Cur: ' + q.Quote__r.CurrencyIsoCode);
}
for (Quote__c q : [SELECT Name, Total_Amount__c, CurrencyIsoCode FROM Quote__c WHERE Total_Amount__c > 0 LIMIT 5]) {
    System.debug('Quote: ' + q.Name + ' | Total: ' + q.Total_Amount__c + ' | Currency: ' + q.CurrencyIsoCode);
}
