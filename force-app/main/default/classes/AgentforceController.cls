public with sharing class AgentforceController {

    /**
     * Main entry point: receives a user message + context and returns an AI response.
     */
    @AuraEnabled
    public static Map<String, Object> processMessage(String userMessage, Id quoteId) {
        Map<String, Object> response = new Map<String, Object>();
        String msg = userMessage.toLowerCase().trim();

        try {
            // ── Intent Detection ──
            if (matchesIntent(msg, new List<String>{'help', 'what can you do', 'commands', 'capabilities'})) {
                return buildHelpResponse();
            }
            if (matchesIntent(msg, new List<String>{'create a quote', 'create quote', 'new quote', 'make a quote', 'generate a quote'})) {
                return handleCreateQuote(userMessage, quoteId);
            }
            if (matchesIntent(msg, new List<String>{'add line', 'add item', 'add a ', 'add resource', 'add product', 'add addon', 'add add-on'})) {
                return handleAddLineItem(userMessage, quoteId);
            }
            if (matchesIntent(msg, new List<String>{'summarize', 'summary', 'what\'s the total', 'whats the total', 'overview', 'quote details', 'tell me about this'})) {
                return handleQuoteSummary(quoteId);
            }
            if (matchesIntent(msg, new List<String>{'submit for approval', 'send for approval', 'send to manager', 'request approval', 'submit quote'})) {
                return handleSubmitApproval(quoteId);
            }
            if (matchesIntent(msg, new List<String>{'search', 'find product', 'show me', 'look up', 'search product', 'find role', 'list products'})) {
                return handleProductSearch(userMessage);
            }
            if (matchesIntent(msg, new List<String>{'recommend', 'suggest', 'what should i add', 'what else', 'suggestions'})) {
                return handleRecommendations(quoteId);
            }

            // Fallback
            response.put('success', true);
            response.put('message', 'I\'m not sure what you mean. Try asking me to:\n• **Summarize** this quote\n• **Add** a line item (e.g. "Add 2 Senior Developers")\n• **Search** for products\n• **Submit** for approval\n• **Recommend** items\n\nType **help** for the full list of commands.');
            response.put('type', 'info');
        } catch (Exception e) {
            response.put('success', false);
            response.put('message', '⚠️ Something went wrong: ' + e.getMessage());
            response.put('type', 'error');
        }

        return response;
    }

    // ═══════════════════════════════════════════════
    //  INTENT HANDLERS
    // ═══════════════════════════════════════════════

    /**
     * Creates a new quote by extracting the account name from the message.
     */
    private static Map<String, Object> handleCreateQuote(String userMessage, Id contextQuoteId) {
        Map<String, Object> resp = new Map<String, Object>();

        // Extract account name — look for "for <account>"
        String accountName = extractAfterKeyword(userMessage, 'for');
        if (String.isBlank(accountName)) {
            resp.put('success', true);
            resp.put('message', 'To create a quote, please say something like:\n**"Create a quote for Acme Corp"**\n\nI\'ll find the account and create a Draft quote.');
            resp.put('type', 'info');
            return resp;
        }

        // Search for the account
        accountName = accountName.replaceAll('[^a-zA-Z0-9 ]', '').trim();
        String likePattern = '%' + accountName + '%';
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Name LIKE :likePattern LIMIT 5];

        if (accounts.isEmpty()) {
            resp.put('success', false);
            resp.put('message', 'I couldn\'t find an account matching **"' + accountName + '"**. Please check the name and try again.');
            resp.put('type', 'error');
            return resp;
        }

        Account acc = accounts[0];

        // Create quote
        Quote__c newQuote = new Quote__c(
            Account__c = acc.Id,
            Status__c = 'Draft'
        );
        insert newQuote;

        // Fetch the auto-generated Name
        newQuote = [SELECT Id, Name FROM Quote__c WHERE Id = :newQuote.Id LIMIT 1];

        resp.put('success', true);
        resp.put('message', '✅ **Quote created successfully!**\n\n• **Quote:** ' + newQuote.Name + '\n• **Account:** ' + acc.Name + '\n• **Status:** Draft\n\nYou can now add line items to this quote.');
        resp.put('type', 'success');
        resp.put('action', 'NAVIGATE');
        resp.put('recordId', newQuote.Id);
        return resp;
    }

    /**
     * Adds a line item to the current quote.
     */
    private static Map<String, Object> handleAddLineItem(String userMessage, Id quoteId) {
        Map<String, Object> resp = new Map<String, Object>();

        if (quoteId == null) {
            resp.put('success', false);
            resp.put('message', 'Please open a quote first before adding line items.');
            resp.put('type', 'error');
            return resp;
        }

        // Check draft status
        List<Quote__c> quotes = [SELECT Status__c FROM Quote__c WHERE Id = :quoteId LIMIT 1];
        if (quotes.isEmpty()) {
            resp.put('success', false);
            resp.put('message', 'Could not find this quote.');
            resp.put('type', 'error');
            return resp;
        }
        if (quotes[0].Status__c != 'Draft') {
            resp.put('success', false);
            resp.put('message', '🔒 This quote is **' + quotes[0].Status__c + '** and cannot be modified. Only Draft quotes can have items added.');
            resp.put('type', 'error');
            return resp;
        }

        // Extract quantity and item name
        String msg = userMessage;
        Decimal quantity = extractQuantity(msg);
        String itemName = extractItemName(msg);

        if (String.isBlank(itemName)) {
            resp.put('success', true);
            resp.put('message', 'Please specify what to add. Examples:\n• **"Add 3 Senior Developers"**\n• **"Add React License"**\n• **"Add 1 Project Manager"**');
            resp.put('type', 'info');
            return resp;
        }

        // Search across all catalog objects
        String likePattern = '%' + itemName + '%';

        // Resource Roles
        List<Resource_Role__c> roles = [SELECT Id, Name, Price__c, Cost__c FROM Resource_Role__c WHERE Name LIKE :likePattern LIMIT 3];
        if (!roles.isEmpty()) {
            Resource_Role__c role = roles[0];
            Quote_Line_Item__c qli = new Quote_Line_Item__c(
                Quote__c = quoteId,
                Resource_Role__c = role.Id,
                Item_Type__c = 'Resource Role',
                Name__c = role.Name,
                Quantity__c = quantity,
                Unit_Price__c = role.Price__c != null ? role.Price__c : 0,
                Unit_Cost__c = role.Cost__c != null ? role.Cost__c : 0,
                Base_Rate__c = role.Price__c != null ? role.Price__c : 0
            );
            insert qli;
            QuoteController.recalculateQuoteTotals(quoteId);

            resp.put('success', true);
            resp.put('message', '✅ Added **' + quantity.intValue() + 'x ' + role.Name + '** (Resource Role)\n\n• Unit Price: $' + formatDecimal(role.Price__c) + '\n• Total: $' + formatDecimal(role.Price__c * quantity));
            resp.put('type', 'success');
            resp.put('action', 'REFRESH');
            return resp;
        }

        // Products
        List<Product__c> products = [SELECT Id, Name, Price__c, Cost__c FROM Product__c WHERE Name LIKE :likePattern LIMIT 3];
        if (!products.isEmpty()) {
            Product__c prod = products[0];
            Quote_Line_Item__c qli = new Quote_Line_Item__c(
                Quote__c = quoteId,
                Product__c = prod.Id,
                Item_Type__c = 'Product',
                Name__c = prod.Name,
                Quantity__c = quantity,
                Unit_Price__c = prod.Price__c != null ? prod.Price__c : 0,
                Unit_Cost__c = prod.Cost__c != null ? prod.Cost__c : 0,
                Base_Rate__c = prod.Price__c != null ? prod.Price__c : 0
            );
            insert qli;
            QuoteController.recalculateQuoteTotals(quoteId);

            resp.put('success', true);
            resp.put('message', '✅ Added **' + quantity.intValue() + 'x ' + prod.Name + '** (Product)\n\n• Unit Price: $' + formatDecimal(prod.Price__c) + '\n• Total: $' + formatDecimal(prod.Price__c * quantity));
            resp.put('type', 'success');
            resp.put('action', 'REFRESH');
            return resp;
        }

        // Add-Ons
        List<Add_On__c> addons = [SELECT Id, Name, Price__c, Cost__c FROM Add_On__c WHERE Name LIKE :likePattern LIMIT 3];
        if (!addons.isEmpty()) {
            Add_On__c addon = addons[0];
            Quote_Line_Item__c qli = new Quote_Line_Item__c(
                Quote__c = quoteId,
                Add_On__c = addon.Id,
                Item_Type__c = 'Add-on',
                Name__c = addon.Name,
                Quantity__c = quantity,
                Unit_Price__c = addon.Price__c != null ? addon.Price__c : 0,
                Unit_Cost__c = addon.Cost__c != null ? addon.Cost__c : 0,
                Base_Rate__c = addon.Price__c != null ? addon.Price__c : 0
            );
            insert qli;
            QuoteController.recalculateQuoteTotals(quoteId);

            resp.put('success', true);
            resp.put('message', '✅ Added **' + quantity.intValue() + 'x ' + addon.Name + '** (Add-on)\n\n• Unit Price: $' + formatDecimal(addon.Price__c) + '\n• Total: $' + formatDecimal(addon.Price__c * quantity));
            resp.put('type', 'success');
            resp.put('action', 'REFRESH');
            return resp;
        }

        resp.put('success', false);
        resp.put('message', 'I couldn\'t find **"' + itemName + '"** in the catalog. Try **"Search ' + itemName + '"** to see available items.');
        resp.put('type', 'error');
        return resp;
    }

    /**
     * Returns a formatted summary of the current quote.
     */
    private static Map<String, Object> handleQuoteSummary(Id quoteId) {
        Map<String, Object> resp = new Map<String, Object>();

        if (quoteId == null) {
            resp.put('success', false);
            resp.put('message', 'Please open a quote to see its summary.');
            resp.put('type', 'error');
            return resp;
        }

        Quote__c q = [
            SELECT Name, Status__c, Total_Amount__c, Total_Cost__c,
                   Margin_Percent__c, Margin_Amount__c,
                   Account__r.Name, Opportunity__r.Name,
                   Start_Date__c, End_Date__c, CurrencyIsoCode
            FROM Quote__c WHERE Id = :quoteId LIMIT 1
        ];

        Integer lineCount = [SELECT COUNT() FROM Quote_Line_Item__c WHERE Quote__c = :quoteId];

        // Count by type
        Integer roleCount = [SELECT COUNT() FROM Quote_Line_Item__c WHERE Quote__c = :quoteId AND Item_Type__c = 'Resource Role'];
        Integer prodCount = [SELECT COUNT() FROM Quote_Line_Item__c WHERE Quote__c = :quoteId AND Item_Type__c = 'Product'];
        Integer addonCount = [SELECT COUNT() FROM Quote_Line_Item__c WHERE Quote__c = :quoteId AND Item_Type__c = 'Add-on'];

        String iso = q.CurrencyIsoCode != null ? q.CurrencyIsoCode : 'USD';
        String marginPct = q.Margin_Percent__c != null ? String.valueOf(q.Margin_Percent__c.setScale(1)) + '%' : 'N/A';
        String marginHealth = '';
        if (q.Margin_Percent__c != null) {
            if (q.Margin_Percent__c >= 40) marginHealth = ' 🟢 Healthy';
            else if (q.Margin_Percent__c >= 20) marginHealth = ' 🟡 Moderate';
            else marginHealth = ' 🔴 Low';
        }

        String summary = '📊 **Quote Summary: ' + q.Name + '**\n\n';
        summary += '• **Status:** ' + q.Status__c + '\n';
        summary += '• **Account:** ' + (q.Account__r != null ? q.Account__r.Name : 'N/A') + '\n';
        if (q.Opportunity__r != null) {
            summary += '• **Opportunity:** ' + q.Opportunity__r.Name + '\n';
        }
        summary += '\n💰 **Financials (' + iso + ')**\n';
        summary += '• Total Amount: **$' + formatDecimal(q.Total_Amount__c) + '**\n';
        summary += '• Total Cost: $' + formatDecimal(q.Total_Cost__c) + '\n';
        summary += '• Margin: **' + marginPct + '**' + marginHealth + '\n';
        summary += '\n📦 **Line Items (' + lineCount + ' total)**\n';
        if (roleCount > 0) summary += '• Resource Roles: ' + roleCount + '\n';
        if (prodCount > 0) summary += '• Products: ' + prodCount + '\n';
        if (addonCount > 0) summary += '• Add-ons: ' + addonCount + '\n';

        if (q.Start_Date__c != null) {
            summary += '\n📅 ' + String.valueOf(q.Start_Date__c) + ' → ' + String.valueOf(q.End_Date__c);
        }

        resp.put('success', true);
        resp.put('message', summary);
        resp.put('type', 'info');
        return resp;
    }

    /**
     * Submits the current quote for approval.
     */
    private static Map<String, Object> handleSubmitApproval(Id quoteId) {
        Map<String, Object> resp = new Map<String, Object>();

        if (quoteId == null) {
            resp.put('success', false);
            resp.put('message', 'Please open a quote first.');
            resp.put('type', 'error');
            return resp;
        }

        Quote__c q = [SELECT Status__c, Name FROM Quote__c WHERE Id = :quoteId LIMIT 1];

        if (q.Status__c != 'Draft') {
            resp.put('success', false);
            resp.put('message', '🔒 This quote is already **' + q.Status__c + '**. Only Draft quotes can be submitted for approval.');
            resp.put('type', 'error');
            return resp;
        }

        // Use existing controller method (handles auto-approval logic)
        QuoteController.submitForApproval(quoteId);

        // Re-query to see the result
        q = [SELECT Status__c FROM Quote__c WHERE Id = :quoteId LIMIT 1];

        if (q.Status__c == 'Approved') {
            resp.put('message', '⚡ Quote was **auto-approved!** Margin met the minimum threshold.');
        } else {
            resp.put('message', '📤 Quote submitted for **manager approval**. You\'ll be notified once a decision is made.');
        }

        resp.put('success', true);
        resp.put('type', 'success');
        resp.put('action', 'REFRESH');
        return resp;
    }

    /**
     * Searches the product catalog.
     */
    private static Map<String, Object> handleProductSearch(String userMessage) {
        Map<String, Object> resp = new Map<String, Object>();

        String searchTerm = extractSearchTerm(userMessage);
        if (String.isBlank(searchTerm)) {
            resp.put('success', true);
            resp.put('message', 'What would you like to search for? Try:\n• **"Search developer"**\n• **"Find license products"**');
            resp.put('type', 'info');
            return resp;
        }

        String likePattern = '%' + searchTerm + '%';
        List<String> results = new List<String>();

        List<Resource_Role__c> roles = [SELECT Name, Price__c FROM Resource_Role__c WHERE Name LIKE :likePattern LIMIT 5];
        for (Resource_Role__c r : roles) {
            results.add('👤 **' + r.Name + '** — $' + formatDecimal(r.Price__c) + '/hr (Resource Role)');
        }

        List<Product__c> products = [SELECT Name, Price__c FROM Product__c WHERE Name LIKE :likePattern LIMIT 5];
        for (Product__c p : products) {
            results.add('📦 **' + p.Name + '** — $' + formatDecimal(p.Price__c) + ' (Product)');
        }

        List<Add_On__c> addons = [SELECT Name, Price__c FROM Add_On__c WHERE Name LIKE :likePattern LIMIT 5];
        for (Add_On__c a : addons) {
            results.add('➕ **' + a.Name + '** — $' + formatDecimal(a.Price__c) + ' (Add-on)');
        }

        if (results.isEmpty()) {
            resp.put('success', true);
            resp.put('message', 'No items found matching **"' + searchTerm + '"**. Try a different search term.');
            resp.put('type', 'info');
        } else {
            resp.put('success', true);
            resp.put('message', '🔍 **Search results for "' + searchTerm + '":**\n\n' + String.join(results, '\n'));
            resp.put('type', 'info');
        }
        return resp;
    }

    /**
     * Recommends items based on current quote contents.
     */
    private static Map<String, Object> handleRecommendations(Id quoteId) {
        Map<String, Object> resp = new Map<String, Object>();

        if (quoteId == null) {
            resp.put('success', false);
            resp.put('message', 'Please open a quote to get recommendations.');
            resp.put('type', 'error');
            return resp;
        }

        // Get current item IDs
        List<Quote_Line_Item__c> currentItems = [
            SELECT Resource_Role__c, Product__c, Add_On__c, Item_Type__c, Name__c
            FROM Quote_Line_Item__c WHERE Quote__c = :quoteId
        ];

        Set<Id> existingRoleIds = new Set<Id>();
        Set<Id> existingProductIds = new Set<Id>();
        Set<Id> existingAddonIds = new Set<Id>();
        Boolean hasRoles = false;
        Boolean hasProducts = false;

        for (Quote_Line_Item__c qli : currentItems) {
            if (qli.Resource_Role__c != null) { existingRoleIds.add(qli.Resource_Role__c); hasRoles = true; }
            if (qli.Product__c != null) { existingProductIds.add(qli.Product__c); hasProducts = true; }
            if (qli.Add_On__c != null) existingAddonIds.add(qli.Add_On__c);
        }

        List<String> suggestions = new List<String>();

        // Suggest roles not yet added
        if (hasRoles) {
            List<Resource_Role__c> otherRoles = [
                SELECT Name, Price__c FROM Resource_Role__c
                WHERE Id NOT IN :existingRoleIds
                ORDER BY Price__c DESC LIMIT 3
            ];
            for (Resource_Role__c r : otherRoles) {
                suggestions.add('👤 **' + r.Name + '** — $' + formatDecimal(r.Price__c) + '/hr');
            }
        }

        // Suggest products not yet added
        if (hasProducts || !hasRoles) {
            List<Product__c> otherProducts = [
                SELECT Name, Price__c FROM Product__c
                WHERE Id NOT IN :existingProductIds
                ORDER BY Price__c DESC LIMIT 3
            ];
            for (Product__c p : otherProducts) {
                suggestions.add('📦 **' + p.Name + '** — $' + formatDecimal(p.Price__c));
            }
        }

        // Always suggest add-ons
        List<Add_On__c> otherAddons = [
            SELECT Name, Price__c FROM Add_On__c
            WHERE Id NOT IN :existingAddonIds
            LIMIT 3
        ];
        for (Add_On__c a : otherAddons) {
            suggestions.add('➕ **' + a.Name + '** — $' + formatDecimal(a.Price__c));
        }

        if (suggestions.isEmpty()) {
            resp.put('message', '✨ Looks like you\'ve already added everything in the catalog! This quote is comprehensive.');
        } else {
            String msg = '💡 **Recommendations for this quote:**\n\n';
            msg += String.join(suggestions, '\n');
            msg += '\n\nTo add any of these, say **"Add [item name]"**.';
            resp.put('message', msg);
        }

        resp.put('success', true);
        resp.put('type', 'info');
        return resp;
    }

    /**
     * Returns help text listing all capabilities.
     */
    private static Map<String, Object> buildHelpResponse() {
        String helpText = '🤖 **CPQ AI Assistant — What I can do:**\n\n';
        helpText += '📝 **Create a Quote**\n';
        helpText += '   _"Create a quote for Acme Corp"_\n\n';
        helpText += '➕ **Add Line Items**\n';
        helpText += '   _"Add 3 Senior Developers"_\n';
        helpText += '   _"Add React License"_\n\n';
        helpText += '📊 **Summarize Quote**\n';
        helpText += '   _"Summarize this quote"_\n\n';
        helpText += '🔍 **Search Catalog**\n';
        helpText += '   _"Search developer"_\n';
        helpText += '   _"Find license products"_\n\n';
        helpText += '💡 **Get Recommendations**\n';
        helpText += '   _"What should I add?"_\n\n';
        helpText += '📤 **Submit for Approval**\n';
        helpText += '   _"Submit for approval"_\n\n';
        helpText += '🛡️ **Safety:** I respect your permissions and only modify Draft quotes.';

        return new Map<String, Object>{
            'success' => true,
            'message' => helpText,
            'type' => 'info'
        };
    }

    // ═══════════════════════════════════════════════
    //  UTILITY METHODS
    // ═══════════════════════════════════════════════

    private static Boolean matchesIntent(String message, List<String> keywords) {
        for (String keyword : keywords) {
            if (message.contains(keyword)) return true;
        }
        return false;
    }

    private static String extractAfterKeyword(String message, String keyword) {
        String lower = message.toLowerCase();
        Integer idx = lower.indexOf(keyword);
        if (idx < 0) return null;
        String after = message.substring(idx + keyword.length()).trim();
        // Remove trailing punctuation
        after = after.replaceAll('[.!?]+$', '').trim();
        // Remove common trailing words
        after = after.replaceAll('(?i)\\s+(please|thanks|thank you|now)$', '').trim();
        return after;
    }

    private static Decimal extractQuantity(String message) {
        // Look for patterns like "add 5 ...", "add 20 ..."
        Pattern p = Pattern.compile('(?i)add\\s+(\\d+)\\s+');
        Matcher m = p.matcher(message);
        if (m.find()) {
            return Decimal.valueOf(m.group(1));
        }
        return 1;
    }

    private static String extractItemName(String message) {
        // Remove the verb phrase and quantity to get the item name
        String cleaned = message.replaceAll('(?i)^(add|include|insert|put)\\s+', '');
        cleaned = cleaned.replaceAll('^\\d+\\s+', ''); // Remove leading numbers
        cleaned = cleaned.replaceAll('(?i)\\s+(to the quote|to quote|to this quote|please|thanks).*$', '');
        cleaned = cleaned.replaceAll('(?i)^(a |an |the |some )', '');
        cleaned = cleaned.replaceAll('(?i)^(line item|item|items)\\s*', '');
        cleaned = cleaned.trim();
        return cleaned;
    }

    private static String extractSearchTerm(String message) {
        String cleaned = message.replaceAll('(?i)^(search|find|show me|look up|list|show)\\s+', '');
        cleaned = cleaned.replaceAll('(?i)\\s*(products?|roles?|items?|add-?ons?)\\s*$', '');
        cleaned = cleaned.replaceAll('(?i)^(for |about )', '');
        cleaned = cleaned.trim();
        return cleaned;
    }

    private static String formatDecimal(Decimal val) {
        if (val == null) return '0';
        return val.setScale(2).format();
    }

    /**
     * Returns the current user's context — used by the LWC to show permissions.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getUserContext() {
        Map<String, Object> ctx = new Map<String, Object>();
        ctx.put('userName', UserInfo.getName());
        ctx.put('userId', UserInfo.getUserId());
        ctx.put('role', QuoteController.getCurrentUserRole());
        return ctx;
    }
}
