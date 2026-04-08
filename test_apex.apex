List<AggregateResult> results = [
    SELECT Account__r.BillingCountry country, COUNT(Id) quoteCount, AVG(Total_Amount__c) avgAmount
    FROM Quote__c
    WHERE Status__c = 'Approved' AND Account__r.BillingCountry != null
    GROUP BY Account__r.BillingCountry
];
System.debug(results);
