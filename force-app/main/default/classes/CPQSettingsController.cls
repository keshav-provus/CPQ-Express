public with sharing class CPQSettingsController {

    /**
     * Retrieves the org default CPQ Settings.
     */
    @AuraEnabled(cacheable=true)
    public static CPQ_Settings__c getSettings() {
        CPQ_Settings__c settings = CPQ_Settings__c.getOrgDefaults();
        if (settings == null) {
            settings = new CPQ_Settings__c();
        }
        return settings;
    }

    /**
     * Upserts the org default CPQ Settings.
     */
    @AuraEnabled
    public static void saveSettings(CPQ_Settings__c newSettings) {
        try {
            CPQ_Settings__c orgDefaults = CPQ_Settings__c.getOrgDefaults();

            // If the settings record doesn't exist, use the provided one and set SetupOwnerId to the OrgId
            if (orgDefaults.Id == null) {
                newSettings.SetupOwnerId = UserInfo.getOrganizationId();
                insert newSettings;
            } else {
                orgDefaults.Resource_Role_Singular__c = newSettings.Resource_Role_Singular__c;
                orgDefaults.Resource_Role_Plural__c = newSettings.Resource_Role_Plural__c;
                orgDefaults.Product_Singular__c = newSettings.Product_Singular__c;
                orgDefaults.Product_Plural__c = newSettings.Product_Plural__c;
                orgDefaults.Add_On_Singular__c = newSettings.Add_On_Singular__c;
                orgDefaults.Add_On_Plural__c = newSettings.Add_On_Plural__c;

                update orgDefaults;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error saving CPQ settings: ' + e.getMessage());
        }
    }
}
