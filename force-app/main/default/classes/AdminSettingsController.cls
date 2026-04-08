public with sharing class AdminSettingsController {

    @AuraEnabled(cacheable=true)
    public static Company_Settings__c getCompanySettings() {
        return Company_Settings__c.getOrgDefaults();
    }

    @AuraEnabled
    public static void saveCompanySettings(Map<String, Object> settings) {
        Company_Settings__c orgDefaults = Company_Settings__c.getOrgDefaults();
        if (orgDefaults == null || orgDefaults.Id == null) {
            orgDefaults = new Company_Settings__c();
        }

        if (settings.containsKey('Company_Name__c')) {
            orgDefaults.Company_Name__c = (String) settings.get('Company_Name__c');
        }
        if (settings.containsKey('Primary_Contact__c')) {
            orgDefaults.Primary_Contact__c = (String) settings.get('Primary_Contact__c');
        }
        if (settings.containsKey('Street_Address__c')) {
            orgDefaults.Street_Address__c = (String) settings.get('Street_Address__c');
        }
        if (settings.containsKey('City__c')) {
            orgDefaults.City__c = (String) settings.get('City__c');
        }
        if (settings.containsKey('State_Province__c')) {
            orgDefaults.State_Province__c = (String) settings.get('State_Province__c');
        }
        if (settings.containsKey('Zip_Postal_Code__c')) {
            orgDefaults.Zip_Postal_Code__c = (String) settings.get('Zip_Postal_Code__c');
        }
        if (settings.containsKey('Country__c')) {
            orgDefaults.Country__c = (String) settings.get('Country__c');
        }

        upsert orgDefaults;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Integer> getLicenseInfo() {
        try {
            UserLicense sfLicense = [SELECT TotalLicenses, UsedLicenses FROM UserLicense WHERE Name = 'Salesforce' LIMIT 1];
            return new Map<String, Integer>{
                'TotalLicenses' => sfLicense.TotalLicenses,
                'UsedLicenses' => sfLicense.UsedLicenses
            };
        } catch (Exception e) {
            // Fallback for scratch orgs or environments where UserLicense query fails
            return new Map<String, Integer>{
                'TotalLicenses' => 10,
                'UsedLicenses' => 1
            };
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getTeamMembers() {
        return [
            SELECT Id, Name, Email, Username, CPQ_Role__c, LastLoginDate, IsActive
            FROM User
            WHERE IsActive = true
              AND Profile.Name = 'Standard User'
            ORDER BY Name ASC
        ];
    }

    @AuraEnabled
    public static Id createUser(String firstName, String lastName, String email, String username, String role) {
        try {
            List<Profile> profiles = [SELECT Id FROM Profile WHERE Name = :role LIMIT 1];
            Id profileId;
            if (profiles.isEmpty()) {
                profiles = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
            }
            if (!profiles.isEmpty()) {
                profileId = profiles[0].Id;
            }

            // Generate a unique alias (up to 8 chars)
            String alias = (firstName != null ? firstName.substring(0, 1) : '') + (lastName != null ? (lastName.length() > 7 ? lastName.substring(0, 7) : lastName) : '');
            if (alias.length() > 8) {
                alias = alias.substring(0, 8);
            }

            User newUser = new User(
                FirstName = firstName,
                LastName = lastName,
                Email = email,
                Username = username,
                Alias = alias.toLowerCase(),
                ProfileId = profileId,
                TimeZoneSidKey = 'America/Los_Angeles',
                LocaleSidKey = 'en_US',
                EmailEncodingKey = 'UTF-8',
                LanguageLocaleKey = 'en_US',
                CPQ_Role__c = role,
                IsActive = true
            );

            insert newUser;

            assignPermissionSet(newUser.Id, role);

            System.resetPassword(newUser.Id, true); // true sends email to user

            return newUser.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating user: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deactivateUser(Id userId) {
        try {
            User u = [SELECT Id, IsActive FROM User WHERE Id = :userId LIMIT 1];
            u.IsActive = false;
            update u;
        } catch (Exception e) {
            throw new AuraHandledException('Error deactivating user: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateUserRole(Id userId, String newRole) {
        try {
            User u = [SELECT Id, CPQ_Role__c, ProfileId FROM User WHERE Id = :userId LIMIT 1];
            u.CPQ_Role__c = newRole;

            List<Profile> profiles = [SELECT Id FROM Profile WHERE Name = :newRole LIMIT 1];
            if (!profiles.isEmpty()) {
                u.ProfileId = profiles[0].Id;
            }

            update u;

            assignPermissionSet(userId, newRole);

        } catch (Exception e) {
            throw new AuraHandledException('Error updating user role: ' + e.getMessage());
        }
    }

    private static void assignPermissionSet(Id userId, String role) {
        if (role == 'User' || role == 'Manager') {
            String permSetName = role == 'User' ? 'CPQ_User' : 'CPQ_Manager';
            List<PermissionSet> permSets = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];

            if (!permSets.isEmpty()) {
                // Delete existing CPQ assignments for this user
                List<PermissionSetAssignment> existing = [SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = :userId AND PermissionSet.Name IN ('CPQ_User', 'CPQ_Manager')];
                if (!existing.isEmpty()) {
                    delete existing;
                }

                PermissionSetAssignment psa = new PermissionSetAssignment(
                    AssigneeId = userId,
                    PermissionSetId = permSets[0].Id
                );
                insert psa;
            }
        }
    }
}
