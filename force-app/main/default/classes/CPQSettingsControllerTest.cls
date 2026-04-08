@isTest
public class CPQSettingsControllerTest {

    @isTest
    static void testGetSettingsEmpty() {
        Test.startTest();
        CPQ_Settings__c settings = CPQSettingsController.getSettings();
        Test.stopTest();

        System.assertNotEquals(null, settings);
        System.assertEquals(null, settings.Id);
    }

    @isTest
    static void testSaveSettingsNew() {
        CPQ_Settings__c newSettings = new CPQ_Settings__c(
            Resource_Role_Singular__c = 'Consultant',
            Resource_Role_Plural__c = 'Consultants'
        );

        Test.startTest();
        CPQSettingsController.saveSettings(newSettings);
        Test.stopTest();

        CPQ_Settings__c savedSettings = CPQ_Settings__c.getOrgDefaults();
        System.assertNotEquals(null, savedSettings.Id);
        System.assertEquals('Consultant', savedSettings.Resource_Role_Singular__c);
    }

    @isTest
    static void testSaveSettingsUpdate() {
        CPQ_Settings__c initialSettings = new CPQ_Settings__c(
            SetupOwnerId = UserInfo.getOrganizationId(),
            Resource_Role_Singular__c = 'Consultant'
        );
        insert initialSettings;

        CPQ_Settings__c updatedSettings = new CPQ_Settings__c(
            Resource_Role_Singular__c = 'Developer'
        );

        Test.startTest();
        CPQSettingsController.saveSettings(updatedSettings);
        Test.stopTest();

        CPQ_Settings__c finalSettings = CPQ_Settings__c.getOrgDefaults();
        System.assertEquals('Developer', finalSettings.Resource_Role_Singular__c);
    }
}
