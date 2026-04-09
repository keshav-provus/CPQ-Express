@isTest
public class DashboardServiceTest {
    @TestSetup
    static void makeData(){
        Account accUS = new Account(Name = 'US Account', BillingCountry = 'United States');
        Account accCA = new Account(Name = 'CA Account', BillingCountry = 'Canada');
        insert new List<Account>{accUS, accCA};

        Opportunity oppUS = new Opportunity(Name = 'US Opp', AccountId = accUS.Id, StageName = 'Prospecting', CloseDate = Date.today().addDays(30));
        Opportunity oppCA = new Opportunity(Name = 'CA Opp', AccountId = accCA.Id, StageName = 'Prospecting', CloseDate = Date.today().addDays(30));
        insert new List<Opportunity>{oppUS, oppCA};

        Quote__c q1 = new Quote__c(Account__c = accUS.Id, Opportunity__c = oppUS.Id, Status__c = 'Draft');
        Quote__c q2 = new Quote__c(Account__c = accUS.Id, Opportunity__c = oppUS.Id, Status__c = 'Draft');
        Quote__c q3 = new Quote__c(Account__c = accCA.Id, Opportunity__c = oppCA.Id, Status__c = 'Draft');
        Quote__c q4 = new Quote__c(Account__c = accCA.Id, Opportunity__c = oppCA.Id, Status__c = 'Draft');
        insert new List<Quote__c>{q1, q2, q3, q4};

        Product__c prod = new Product__c(Name = 'Test Data', Active__c = true, Price__c = 100, Product_Code__c = 'PROD-001');
        insert prod;

        Quote_Line_Item__c qli1 = new Quote_Line_Item__c(Quote__c = q1.Id, Product__c = prod.Id, Quantity__c = 10, Unit_Price__c = 100); // Net 1000
        Quote_Line_Item__c qli2 = new Quote_Line_Item__c(Quote__c = q2.Id, Product__c = prod.Id, Quantity__c = 20, Unit_Price__c = 100); // Net 2000
        Quote_Line_Item__c qli3 = new Quote_Line_Item__c(Quote__c = q3.Id, Product__c = prod.Id, Quantity__c = 5, Unit_Price__c = 100);  // Net 500
        Quote_Line_Item__c qli4 = new Quote_Line_Item__c(Quote__c = q4.Id, Product__c = prod.Id, Quantity__c = 15, Unit_Price__c = 100); // Net 1500
        insert new List<Quote_Line_Item__c>{qli1, qli2, qli3, qli4};

        q1.Status__c = 'Approved';
        q2.Status__c = 'Approved';
        q3.Status__c = 'Approved';
        update new List<Quote__c>{q1, q2, q3};
    }

    @isTest
    static void testGetQuoteMapLocationsByCountry() {
        DashboardService service = new DashboardService();
        List<Map<String, Object>> markers = service.getQuoteMapLocationsByCountry();

        System.assertEquals(2, markers.size(), 'Should return markers for 2 countries');

        Boolean foundUS = false;
        Boolean foundCA = false;

        for (Map<String, Object> marker : markers) {
            String title = (String) marker.get('title');
            if (title == 'United States') {
                foundUS = true;
                System.assertEquals('Quotes: 2, Revenue: $3000.00', marker.get('description'));
            } else if (title == 'Canada') {
                foundCA = true;
                System.assertEquals('Quotes: 1, Revenue: $500.00', marker.get('description'));
            }
        }

        System.assert(foundUS, 'US marker should be found');
        System.assert(foundCA, 'CA marker should be found');
    }
}
