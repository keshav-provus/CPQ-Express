public with sharing class QuotePDFController {
    public Quote__c quote { get; private set; }
    public List<Quote_Line_Item__c> lineItems { get; private set; }
    public String companyName { get; private set; }
    public String companyAddress { get; private set; }
    public String companyEmail { get; private set; }
    public String todayDate { get; private set; }

    public QuotePDFController() {
        Id quoteId = ApexPages.currentPage().getParameters().get('id');
        if (quoteId != null) {
            quote = [
                SELECT Id, Name, Status__c, Opportunity__c, Opportunity__r.Name,
                       Account__c, Account__r.Name, CreatedById, CreatedBy.Name,
                       Total_Amount__c, Total_Cost__c, Margin_Percent__c, Margin_Amount__c,
                       Start_Date__c, End_Date__c, Valid_Until__c, Phase_List__c,
                       Time_Period_Metric__c, Time_Period_Count__c,
                       Account__r.BillingStreet, Account__r.BillingCity, Account__r.BillingState, Account__r.BillingPostalCode, Account__r.BillingCountry
                FROM Quote__c
                WHERE Id = :quoteId
                LIMIT 1
            ];

            lineItems = [
                SELECT Id, Name__c, Item_Type__c, Task__c, Phase__c, Quantity__c,
                       Unit_Price__c, Net_Total__c, Discount__c, List_Price__c
                FROM Quote_Line_Item__c
                WHERE Quote__c = :quoteId
                ORDER BY Phase__c, CreatedDate
            ];
        }

        companyName = 'PRECISION ARCHITECT';
        companyAddress = '1200 Innovation Drive, San Francisco, CA 94105';
        companyEmail = 'contact@precision.arch';
        todayDate = Date.today().format();
    }
}
