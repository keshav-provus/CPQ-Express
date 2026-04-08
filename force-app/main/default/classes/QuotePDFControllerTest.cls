@isTest
public class QuotePDFControllerTest {
    @isTest
    static void testController() {
        Account acc = new Account(Name = 'Test Acc');
        insert acc;

        Opportunity opp = new Opportunity(Name = 'Test Opp', StageName = 'Prospecting', CloseDate = Date.today(), AccountId = acc.Id);
        insert opp;

        Quote__c q = new Quote__c(Opportunity__c = opp.Id, Account__c = acc.Id);
        insert q;

        Quote_Line_Item__c qli = new Quote_Line_Item__c(Quote__c = q.Id, Quantity__c = 1, Unit_Price__c = 100, Name__c = 'Test Item');
        insert qli;

        Test.startTest();
        PageReference pageRef = Page.QuotePDF;
        pageRef.getParameters().put('id', q.Id);
        Test.setCurrentPage(pageRef);

        QuotePDFController controller = new QuotePDFController();
        Test.stopTest();

        System.assertEquals(q.Id, controller.quote.Id);
        System.assertEquals(1, controller.lineItems.size());
    }
}
