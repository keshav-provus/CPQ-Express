@isTest
public class DashboardServiceTest {
    @TestSetup
    static void makeData(){
        Account accUS = new Account(Name = 'US Account', BillingCountry = 'United States');
        Account accCA = new Account(Name = 'CA Account', BillingCountry = 'Canada');
        insert new List<Account>{accUS, accCA};

        Quote__c q1 = new Quote__c(Account__c = accUS.Id, Total_Amount__c = 1000, Status__c = 'Approved');
        Quote__c q2 = new Quote__c(Account__c = accUS.Id, Total_Amount__c = 2000, Status__c = 'Approved');
        Quote__c q3 = new Quote__c(Account__c = accCA.Id, Total_Amount__c = 500, Status__c = 'Approved');
        Quote__c q4 = new Quote__c(Account__c = accCA.Id, Total_Amount__c = 1500, Status__c = 'Draft'); // Should be ignored
        insert new List<Quote__c>{q1, q2, q3, q4};
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
                System.assertEquals('Quotes: 2, Avg Amount: $1500.00', marker.get('description'));
            } else if (title == 'Canada') {
                foundCA = true;
                System.assertEquals('Quotes: 1, Avg Amount: $500.00', marker.get('description'));
            }
        }

        System.assert(foundUS, 'US marker should be found');
        System.assert(foundCA, 'CA marker should be found');
    }
}
