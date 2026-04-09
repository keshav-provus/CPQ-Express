// First, update the Default_Currency__c to USD
Company_Settings__c s = Company_Settings__c.getOrgDefaults();
s.Default_Currency__c = 'USD';
upsert s;

// Run the fixed batch chain: Resource_Role → Product → Add_On → QLI → Quote
Database.executeBatch(new CurrencyConverterBatch('USD'), 200);
System.debug('Currency conversion to USD initiated.');
