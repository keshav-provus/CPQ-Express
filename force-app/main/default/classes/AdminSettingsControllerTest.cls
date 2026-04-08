@isTest
private class AdminSettingsControllerTest {

    @isTest
    static void testGetAndSaveCompanySettings() {
        Company_Settings__c cs = AdminSettingsController.getCompanySettings();
        if (cs == null) {
            System.assertEquals(null, cs, 'Initially may be null');
        } else {
            System.assertEquals(null, cs.Company_Name__c, 'Initially should be null');
        }

        Map<String, Object> settings = new Map<String, Object>{
            'Company_Name__c' => 'Test Corp',
            'Primary_Contact__c' => 'Test Contact',
            'Street_Address__c' => '123 Main St',
            'City__c' => 'San Francisco',
            'State_Province__c' => 'CA',
            'Zip_Postal_Code__c' => '94105',
            'Country__c' => 'USA'
        };

        Test.startTest();
        AdminSettingsController.saveCompanySettings(settings);
        Test.stopTest();

        cs = AdminSettingsController.getCompanySettings();
        System.assertEquals('Test Corp', cs.Company_Name__c);
        System.assertEquals('San Francisco', cs.City__c);
    }

    @isTest
    static void testGetLicenseInfo() {
        Test.startTest();
        Map<String, Integer> licenseInfo = AdminSettingsController.getLicenseInfo();
        Test.stopTest();

        System.assertNotEquals(null, licenseInfo, 'License info should not be null');
        System.assert(licenseInfo.containsKey('TotalLicenses'));
        System.assert(licenseInfo.containsKey('UsedLicenses'));
    }

    @isTest
    static void testCreateAndGetTeamMembers() {
        // Create standard user via controller
        Test.startTest();
        Id userId = AdminSettingsController.createUser(
            'TestFn',
            'TestLn',
            'testfn.testln@example.com.test',
            'testfn.testln@example.com.test',
            'Manager'
        );
        Test.stopTest();

        System.assertNotEquals(null, userId, 'User should be created');

        List<User> team = AdminSettingsController.getTeamMembers();
        Boolean found = false;
        for (User u : team) {
            if (u.Id == userId) {
                found = true;
                System.assertEquals('Manager', u.CPQ_Role__c);
                break;
            }
        }
        System.assert(found, 'Created user should be returned in team members list');
    }

    @isTest
    static void testDeactivateUser() {
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];

        User testUser = new User(
            FirstName = 'ToDeactivate',
            LastName = 'User',
            Email = 'deactivate@example.com',
            Username = 'deactivate@example.com.test' + System.currentTimeMillis(),
            Alias = 'deact',
            ProfileId = standardProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            IsActive = true
        );
        insert testUser;

        Test.startTest();
        AdminSettingsController.deactivateUser(testUser.Id);
        Test.stopTest();

        User updatedUser = [SELECT Id, IsActive FROM User WHERE Id = :testUser.Id];
        System.assertEquals(false, updatedUser.IsActive, 'User should be deactivated');
    }

    @isTest
    static void testUpdateUserRole() {
        Profile standardProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];

        User testUser = new User(
            FirstName = 'ToUpdate',
            LastName = 'RoleUser',
            Email = 'role@example.com',
            Username = 'role@example.com.test' + System.currentTimeMillis(),
            Alias = 'roler',
            ProfileId = standardProfile.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            CPQ_Role__c = 'User',
            IsActive = true
        );
        insert testUser;

        Test.startTest();
        AdminSettingsController.updateUserRole(testUser.Id, 'Admin');
        Test.stopTest();

        User updatedUser = [SELECT Id, CPQ_Role__c FROM User WHERE Id = :testUser.Id];
        System.assertEquals('Admin', updatedUser.CPQ_Role__c, 'User role should be updated');
    }
}
