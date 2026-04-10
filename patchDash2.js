const fs = require('fs');

let code = fs.readFileSync('force-app/main/default/classes/DashboardService.cls', 'utf8');

code = code.replace(/List<Resource_Role__c> roles = \[SELECT Id, Name FROM Resource_Role__c ORDER BY CreatedDate DESC LIMIT 1\];/, 
    'List<Resource_Role__c> roles = [SELECT Id, Name, Name__c FROM Resource_Role__c ORDER BY CreatedDate DESC LIMIT 1];');
    
code = code.replace(/'title' => roles\[0\]\.Name,/, 
    '\'title\' => roles[0].Name__c != null ? roles[0].Name__c : roles[0].Name,');

code = code.replace(/'desc' => 'New Resource Role ' \+ roles\[0\]\.Name \+ ' added',/, 
    '\'desc\' => \'New Resource Role \' + (roles[0].Name__c != null ? roles[0].Name__c : roles[0].Name) + \' added\',');

code = code.replace(/SELECT Id, Discount_Percent__c, Lower_Bound__c, Upper_Bound__c, Product__r\.Name, Resource_Role__r\.Name, Add_On__r\.Name/,
    'SELECT Id, Discount_Percent__c, Lower_Bound__c, Upper_Bound__c, Product__r.Name, Resource_Role__r.Name, Resource_Role__r.Name__c, Add_On__r.Name');

code = code.replace(/} else if \(dt\.Resource_Role__r != null\) \{\n\s*title = dt\.Resource_Role__r\.Name;\n\s*}/, 
    `} else if (dt.Resource_Role__r != null) {
                    title = dt.Resource_Role__r.Name__c != null ? dt.Resource_Role__r.Name__c : dt.Resource_Role__r.Name;
                }`);

fs.writeFileSync('force-app/main/default/classes/DashboardService.cls', code);
console.log('Update done!');
