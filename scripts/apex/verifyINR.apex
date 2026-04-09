System.debug('=== AFTER CONVERSION ===');
for (Resource_Role__c r : [SELECT Name__c, Price__c, Cost__c, CurrencyIsoCode FROM Resource_Role__c LIMIT 3]) {
    System.debug('Role: ' + r.Name__c + ' | Price: ' + r.Price__c + ' | Cost: ' + r.Cost__c + ' | Cur: ' + r.CurrencyIsoCode);
}
for (Quote__c q : [SELECT Name, Total_Amount__c, CurrencyIsoCode, Status__c FROM Quote__c WHERE Status__c = 'Draft' AND Total_Amount__c > 0 LIMIT 5]) {
    System.debug('Quote: ' + q.Name + ' | Total: ' + q.Total_Amount__c + ' | Cur: ' + q.CurrencyIsoCode);
}
for (Quote_Line_Item__c qli : [SELECT Name__c, Unit_Price__c, Unit_Cost__c, Resource_Role__c, CurrencyIsoCode, Quote__r.Name, Quote__r.Status__c FROM Quote_Line_Item__c WHERE Quote__r.Status__c = 'Draft' LIMIT 5]) {
    System.debug('QLI: ' + qli.Name__c + ' | Price: ' + qli.Unit_Price__c + ' | Cost: ' + qli.Unit_Cost__c + ' | Cur: ' + qli.CurrencyIsoCode + ' | Quote: ' + qli.Quote__r.Name);
}
