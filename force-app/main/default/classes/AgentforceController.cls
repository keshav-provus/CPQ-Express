/**
 * @description Intelligent AI Assistant Controller for CPQ Express.
 *              Provides LLM-powered natural language quote management with full
 *              catalog awareness, disambiguation, and structured responses.
 */
public with sharing class AgentforceController {

    // ═══════════════════════════════════════════════════════════════
    //  INNER CLASSES
    // ═══════════════════════════════════════════════════════════════

    /** Complete CPQ context assembled for every AI interaction */
    private class CPQContext {
        public Quote__c quote;
        public List<Quote_Line_Item__c> lineItems;
        public List<Resource_Role__c> resourceRoles;
        public List<Product__c> products;
        public List<Add_On__c> addOns;
        public List<Discount_Tier__c> discountTiers;
        public String userRole;
        public String userName;
        public Decimal marginThreshold;
    }

    /** Catalog item wrapper used for search and disambiguation */
    private class CatalogItem {
        public Id itemId;
        public String name;
        public Decimal price;
        public Decimal cost;
        public String itemType;     // 'Resource Role', 'Product', 'Add-on'
        public String icon;
        public String detail;
        public String billingUnit;
    }

    // ═══════════════════════════════════════════════════════════════
    //  MAIN ENTRY POINTS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Primary entry point. Receives user message with full context,
     *              attempts LLM processing, falls back to smart Apex engine.
     * @param userMessage The raw text from the user.
     * @param quoteId Current quote context (can be null).
     * @param pageContextJson JSON string of visible page data (fields, values).
     * @param conversationHistoryJson JSON array of previous messages for context.
     * @return Map<String, Object> Structured AI response.
     */
    @AuraEnabled
    public static Map<String, Object> processMessage(
        String userMessage,
        Id quoteId,
        String pageContextJson,
        String conversationHistoryJson
    ) {
        try {
            // 1. Build full context
            CPQContext ctx = buildContext(quoteId);

            // 2. Attempt LLM-powered processing
            Map<String, Object> response = processWithLLM(userMessage, ctx, conversationHistoryJson);

            // 3. If LLM unavailable, use smart Apex engine
            if (response == null) {
                response = processWithEngine(userMessage, ctx, conversationHistoryJson);
            }

            return response;
        } catch (Exception e) {
            return buildRecoveryResponse(e);
        }
    }

    /**
     * @description Executes a specific action directly (used when user clicks a
     *              disambiguation option or action button in the chat).
     * @param actionType The action to perform (ADD_ITEM, REMOVE_ITEM, etc.).
     * @param actionDataJson JSON with action parameters.
     * @param quoteId Current quote context.
     * @return Map<String, Object> Structured action result.
     */
    @AuraEnabled
    public static Map<String, Object> executeAction(String actionType, String actionDataJson, Id quoteId) {
        try {
            Map<String, Object> actionData = (Map<String, Object>) JSON.deserializeUntyped(actionDataJson);
            CPQContext ctx = buildContext(quoteId);

            if (actionType == 'ADD_ITEM') {
                return executeAddItem(actionData, ctx);
            }
            if (actionType == 'REMOVE_ITEM') {
                return executeRemoveItem(actionData, ctx);
            }
            if (actionType == 'APPLY_DISCOUNT') {
                return executeApplyDiscount(actionData, ctx);
            }
            if (actionType == 'UPDATE_QUANTITY') {
                return executeUpdateQuantity(actionData, ctx);
            }
            if (actionType == 'SELECT_ACCOUNT') {
                return handleSelectAccount(actionData);
            }
            if (actionType == 'SELECT_OPPORTUNITY') {
                return handleSelectOpportunity(actionData);
            }
            if (actionType == 'CREATE_QUOTE_FINAL') {
                return handleCreateQuoteFinal(actionData);
            }
            if (actionType == 'CREATE_ACCOUNT') {
                return handleCreateAccount(actionData);
            }

            return buildResponse('text', 'Unknown action type: "' + actionType + '". Try saying **"help"** to see what I can do.', false, null, null, null);
        } catch (Exception e) {
            return buildRecoveryResponse(e);
        }
    }

    /**
     * @description Returns the current user's context for the UI.
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getUserContext() {
        Map<String, Object> ctx = new Map<String, Object>();
        ctx.put('userName', UserInfo.getName());
        ctx.put('userId', UserInfo.getUserId());
        ctx.put('role', QuoteController.getCurrentUserRole());
        return ctx;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONTEXT BUILDER
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Assembles the complete CPQ context: catalog, quote state,
     *              line items, user permissions, and pricing rules.
     */
    private static CPQContext buildContext(Id quoteId) {
        CPQContext ctx = new CPQContext();

        // Catalog
        ctx.resourceRoles = [
            SELECT Id, Name, Price__c, Cost__c, Billing_Unit__c
            FROM Resource_Role__c ORDER BY Name
        ];
        ctx.products = [
            SELECT Id, Name, Product_Code__c, Product_Type__c, Price__c, Cost__c, Billing_Unit__c, Active__c
            FROM Product__c WHERE Active__c = true ORDER BY Name
        ];
        ctx.addOns = [
            SELECT Id, Name, Price__c, Cost__c, Billing_Unit__c
            FROM Add_On__c ORDER BY Name
        ];

        // Quote context (if applicable)
        if (quoteId != null) {
            List<Quote__c> quotes = [
                SELECT Id, Name, Status__c, Account__c, Account__r.Name,
                       Opportunity__c, Opportunity__r.Name,
                       Total_Amount__c, Total_Cost__c, Margin_Percent__c, Margin_Amount__c,
                       Start_Date__c, End_Date__c, CurrencyIsoCode,
                       CreatedBy.Name, CreatedDate, LastModifiedBy.Name, LastModifiedDate,
                       Submitted_By__r.Name, Submitted_Date__c,
                       Approved_By__r.Name, Approved_Date__c,
                       Valid_Until__c, Phase_List__c
                FROM Quote__c WHERE Id = :quoteId LIMIT 1
            ];
            if (!quotes.isEmpty()) {
                ctx.quote = quotes[0];
            }

            ctx.lineItems = [
                SELECT Id, Name__c, Item_Type__c, Quantity__c, Unit_Price__c, Unit_Cost__c,
                       Net_Total__c, Total_Line_Cost__c, Discount_Percent__c,
                       Product__c, Product__r.Name,
                       Resource_Role__c, Resource_Role__r.Name,
                       Add_On__c, Add_On__r.Name,
                       Base_Rate__c, Phase__c
                FROM Quote_Line_Item__c
                WHERE Quote__c = :quoteId
                ORDER BY CreatedDate ASC
            ];
        } else {
            ctx.lineItems = new List<Quote_Line_Item__c>();
        }

        // User context
        ctx.userName = UserInfo.getName();
        ctx.userRole = QuoteController.getCurrentUserRole();

        // Margin threshold from org settings
        Company_Settings__c settings = Company_Settings__c.getOrgDefaults();
        ctx.marginThreshold = settings?.Minimum_Margin__c != null ? settings.Minimum_Margin__c : 15;

        return ctx;
    }

    // ═══════════════════════════════════════════════════════════════
    //  LLM INTEGRATION (Einstein Models API)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Attempts to process the user message using Einstein LLM.
     *              Returns null if LLM is unavailable, triggering fallback.
     */
    private static Map<String, Object> processWithLLM(String userMessage, CPQContext ctx, String conversationHistory) {
        try {
            String systemPrompt = buildSystemPrompt(ctx, conversationHistory);
            String fullPrompt = systemPrompt + '\n\nUser message: ' + userMessage + '\n\nRespond with JSON only:';

            // Use Salesforce Models API (aiplatform namespace)
            aiplatform.ModelsAPI.createGenerations_Request request = new aiplatform.ModelsAPI.createGenerations_Request();
            request.modelName = 'sfdc_ai__DefaultGPT4Omni';

            aiplatform.ModelsAPI_GenerationRequest body = new aiplatform.ModelsAPI_GenerationRequest();
            body.prompt = fullPrompt;
            request.body = body;

            aiplatform.ModelsAPI modelsAPI = new aiplatform.ModelsAPI();
            aiplatform.ModelsAPI.createGenerations_Response response = modelsAPI.createGenerations(request);

            if (response != null && response.Code200 != null && response.Code200.generation != null) {
                String llmText = response.Code200.generation.generatedText;
                if (String.isNotBlank(llmText)) {
                    return parseLLMResponse(llmText, ctx);
                }
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.INFO, 'Einstein LLM not available, using Apex engine. Error: ' + e.getMessage());
        }
        return null; // Fallback to smart engine
    }

    /**
     * @description Builds a comprehensive system prompt with full CPQ context
     *              so the LLM has complete awareness of the org.
     */
    private static String buildSystemPrompt(CPQContext ctx, String conversationHistory) {
        String prompt = 'You are CPQ Express AI — an intelligent quoting assistant embedded in Salesforce.\n';
        prompt += 'You have COMPLETE knowledge of the product catalog, quote state, and pricing rules.\n\n';

        // Catalog
        prompt += '=== AVAILABLE CATALOG ===\n';
        prompt += 'Resource Roles:\n';
        for (Resource_Role__c r : ctx.resourceRoles) {
            prompt += '- ' + r.Name + ' | $' + fmtDec(r.Price__c) + '/hr | Cost: $' + fmtDec(r.Cost__c) + '/hr\n';
        }
        prompt += '\nProducts:\n';
        for (Product__c p : ctx.products) {
            prompt += '- ' + p.Name + ' | $' + fmtDec(p.Price__c) + ' | Type: ' + nn(p.Product_Type__c) + '\n';
        }
        prompt += '\nAdd-ons:\n';
        for (Add_On__c a : ctx.addOns) {
            prompt += '- ' + a.Name + ' | $' + fmtDec(a.Price__c) + '\n';
        }

        // Quote context
        prompt += '\n=== CURRENT QUOTE ===\n';
        if (ctx.quote != null) {
            prompt += 'Quote: ' + ctx.quote.Name + '\n';
            prompt += 'Status: ' + nn(ctx.quote.Status__c) + '\n';
            prompt += 'Account: ' + (ctx.quote.Account__r != null ? ctx.quote.Account__r.Name : 'N/A') + '\n';
            prompt += 'Total Amount: $' + fmtDec(ctx.quote.Total_Amount__c) + '\n';
            prompt += 'Total Cost: $' + fmtDec(ctx.quote.Total_Cost__c) + '\n';
            prompt += 'Margin: ' + fmtDec(ctx.quote.Margin_Percent__c) + '%\n';
            prompt += 'Minimum Margin Threshold: ' + ctx.marginThreshold + '%\n';
            prompt += '\nCurrent Line Items:\n';
            if (ctx.lineItems.isEmpty()) {
                prompt += '(No items yet)\n';
            } else {
                for (Quote_Line_Item__c qli : ctx.lineItems) {
                    prompt += '- ' + qli.Quantity__c?.intValue() + 'x ' + nn(qli.Name__c) + ' @ $' + fmtDec(qli.Unit_Price__c) + ' = $' + fmtDec(qli.Net_Total__c) + ' (' + nn(qli.Item_Type__c) + ')\n';
                }
            }
        } else {
            prompt += 'No quote is currently open.\n';
        }

        prompt += '\n=== RESPONSE FORMAT ===\n';
        prompt += 'Respond ONLY with valid JSON in this format:\n';
        prompt += '{\n';
        prompt += '  "responseType": "text|disambiguation|summary|action",\n';
        prompt += '  "message": "Your response (use **bold** for emphasis, \\n for newlines)",\n';
        prompt += '  "needsDisambiguation": false,\n';
        prompt += '  "options": [{"id":"recordId", "name":"Item Name", "price":100, "type":"Resource Role|Product|Add-on"}],\n';
        prompt += '  "intent": "add_item|remove_item|create_quote|summarize|search|recommend|submit|analyze|help|general",\n';
        prompt += '  "actionData": {"itemId":"...", "itemType":"...", "quantity":1},\n';
        prompt += '  "action": "REFRESH|null"\n';
        prompt += '}\n\n';

        prompt += '=== RULES ===\n';
        prompt += '1. When adding an item with multiple matches (e.g. "add developer" matches Salesforce Developer, Sr. Developer, Jr. Developer), set needsDisambiguation=true and list ALL matches in options.\n';
        prompt += '2. Only Draft quotes can be modified. Refuse modifications on non-Draft quotes.\n';
        prompt += '3. Format currency with $ and commas. Be concise and professional.\n';
        prompt += '4. If the user asks about the quote, provide accurate details from the context above.\n';
        prompt += '5. Always provide structured, clean responses with clear sections.\n';
        prompt += '6. When the user wants to create a new quote, ALWAYS set intent to "create_quote". You CAN create quotes — the system has a built-in multi-step flow for this.\n';

        // Conversation history
        if (String.isNotBlank(conversationHistory)) {
            prompt += '\n=== RECENT CONVERSATION ===\n' + conversationHistory + '\n';
        }

        return prompt;
    }

    /**
     * @description Parses the LLM JSON response into a structured Map for the LWC.
     */
    private static Map<String, Object> parseLLMResponse(String llmText, CPQContext ctx) {
        // Clean up the response (remove markdown code fences if present)
        String cleaned = llmText.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replaceAll('^```[a-z]*\\n?', '').replaceAll('\\n?```$', '');
        }

        // Handle cases where the LLM appends trailing text after the JSON block
        Integer firstBrace = cleaned.indexOf('{');
        Integer lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace != -1 && lastBrace != -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        try {
            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(cleaned);
            String intent = (String) parsed.get('intent');
            Boolean needsDisambiguation = parsed.get('needsDisambiguation') == true;

            // Route create_quote intent back to Apex engine (multi-step flow)
            if (intent == 'create_quote') {
                return null; // Let Apex engine handle with handleCreateQuote()
            }

            // If LLM says add_item with a single clear match, execute it
            if (intent == 'add_item' && !needsDisambiguation && parsed.get('actionData') != null) {
                Map<String, Object> actionData = (Map<String, Object>) parsed.get('actionData');
                if (actionData.containsKey('itemId') && String.isNotBlank((String) actionData.get('itemId'))) {
                    Map<String, Object> result = executeAddItem(actionData, ctx);
                    result.put('action', 'REFRESH');
                    return result;
                }
            }

            // Build response from LLM output
            Map<String, Object> response = new Map<String, Object>();
            response.put('success', true);
            response.put('responseType', nn((String) parsed.get('responseType')));
            response.put('message', (String) parsed.get('message'));
            response.put('action', parsed.get('action'));

            if (needsDisambiguation && parsed.get('options') != null) {
                response.put('responseType', 'disambiguation');
                // Resolve LLM-generated option IDs against the actual catalog
                List<Object> rawOptions = (List<Object>) parsed.get('options');
                List<Map<String, Object>> resolvedOptions = resolveOptionIds(rawOptions, ctx);
                response.put('options', resolvedOptions);
                response.put('pendingAction', 'ADD_ITEM');
                Object qtyObj = parsed.get('actionData') != null ? ((Map<String, Object>) parsed.get('actionData')).get('quantity') : 1;
                response.put('pendingQuantity', qtyObj != null ? qtyObj : 1);
            }

            return response;
        } catch (Exception e) {
            // If JSON parsing fails, return LLM text as plain message
            return buildResponse('text', cleaned, true, null, null, null);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  SMART APEX ENGINE (Primary Fallback)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Processes the user message using weighted keyword matching,
     *              fuzzy search, and structured response generation.
     */
    private static Map<String, Object> processWithEngine(String userMessage, CPQContext ctx, String conversationHistoryJson) {
        // Strategy 3: Check conversation context for pending follow-ups
        Map<String, Object> contextResult = handleConversationContext(userMessage, conversationHistoryJson);
        if (contextResult != null) return contextResult;

        String msg = userMessage.toLowerCase().trim();
        String intent = detectIntent(msg);

        switch on intent {
            when 'add_item'       { return handleAddItem(userMessage, ctx); }
            when 'remove_item'    { return handleRemoveItem(userMessage, ctx); }
            when 'apply_discount' { return handleApplyDiscount(userMessage, ctx); }
            when 'update_quantity' { return handleUpdateQuantity(userMessage, ctx); }
            when 'create_quote'   { return handleCreateQuote(ctx); }
            when 'summarize'      { return handleSummarize(ctx); }
            when 'search'         { return handleSearch(userMessage, ctx); }
            when 'recommend'      { return handleRecommend(ctx); }
            when 'submit'         { return handleSubmit(ctx); }
            when 'analyze'        { return handleAnalyze(ctx); }
            when 'help'           { return handleHelp(); }
            when 'details'        { return handleQuoteDetails(userMessage, ctx); }
            when else             { return handleGeneral(userMessage, ctx); }
        }
    }

    /**
     * @description Weighted keyword scoring for intent detection. Multi-word
     *              keywords score higher for more specific matching.
     */
    private static String detectIntent(String msg) {
        Map<String, List<String>> intentMap = new Map<String, List<String>>{
            'create_quote' => new List<String>{'create a quote', 'create quote', 'new quote', 'make a quote', 'create new quote', 'start a quote', 'start new quote', 'generate a quote', 'open a new quote'},
            'add_item'    => new List<String>{'add line', 'add item', 'add a ', 'add an ', 'add resource', 'add product', 'include', 'i need', 'i want', 'throw in', 'get me', 'put in', 'add addon', 'add add-on'},
            'remove_item' => new List<String>{'remove', 'delete', 'take out', 'drop', 'get rid of', 'eliminate'},
            'apply_discount' => new List<String>{'apply discount', 'give discount', 'add discount', 'discount of', 'reduce price', 'lower price', 'mark down', 'price reduction', 'set discount', '% discount', '% off'},
            'update_quantity' => new List<String>{'change quantity', 'update quantity', 'adjust quantity', 'modify quantity', 'set quantity', 'increase quantity', 'decrease quantity', 'change qty', 'update qty'},
            'summarize'   => new List<String>{'summarize', 'summary', 'overview', 'tell me about this', 'what is this', 'break down', 'run down'},
            'search'      => new List<String>{'search', 'find', 'look up', 'show me all', 'list all', 'what products', 'available products', 'available roles', 'catalog', 'browse'},
            'recommend'   => new List<String>{'recommend', 'suggest', 'what should i add', 'what else', 'ideas', 'suggestion'},
            'submit'      => new List<String>{'submit for approval', 'send for approval', 'submit quote', 'send to manager', 'request approval'},
            'analyze'     => new List<String>{'analyze', 'analysis', 'how is the margin', 'margin health', 'how does this look', 'competitive', 'pricing analysis', 'is this good', 'deal health', 'score'},
            'help'        => new List<String>{'help', 'what can you do', 'capabilities', 'commands', 'how to use'},
            'details'     => new List<String>{'who created', 'when was', 'what is the status', 'account name', 'opportunity', 'total amount', 'total cost', 'how many items', 'how many lines', 'start date', 'end date', 'what\'s the total', 'whats the total'}
        };

        String bestIntent = 'general';
        Integer bestScore = 0;

        for (String intent : intentMap.keySet()) {
            Integer score = 0;
            for (String keyword : intentMap.get(intent)) {
                if (msg.contains(keyword)) {
                    // Multi-word keywords score higher (more specific)
                    score += keyword.split(' ').size() * 2;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestIntent = intent;
            }
        }

        return bestIntent;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CONVERSATION CONTEXT (Strategy 3: Multi-turn parameter gathering)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Checks the LAST assistant message for pending context.
     *              Only inspects the most recent message to avoid false positives.
     */
    private static Map<String, Object> handleConversationContext(String userMessage, String conversationHistoryJson) {
        if (String.isBlank(conversationHistoryJson)) return null;

        String lastAssistantMsg = extractLastAssistantMessage(conversationHistoryJson);
        if (String.isBlank(lastAssistantMsg)) return null;

        String lastLower = lastAssistantMsg.toLowerCase();
        String msgLower = userMessage.toLowerCase().trim();

        if (isKnownCommand(msgLower)) return null;

        // Context: AI was asking for an OPPORTUNITY — don't redirect to account search
        if (lastLower.contains('select an opportunity') || lastLower.contains('link the quote to') || lastLower.contains('create a new one')) {
            return null;
        }

        // Context: AI was asking for an ACCOUNT
        if (lastLower.contains('which account') || lastLower.contains('select an account') || lastLower.contains('account is this quote for')) {
            return searchAndShowAccounts(userMessage);
        }

        // Context: AI was asking for discount percentage
        if (lastLower.contains('discount percentage') || lastLower.contains('what discount')) {
            Decimal pct = extractDiscountPercent(userMessage);
            if (pct != null) {
                // This is just a percentage reply — the full discount flow will handle it
                return null;
            }
        }

        return null;
    }

    private static String extractLastAssistantMessage(String historyJson) {
        if (String.isBlank(historyJson)) return null;
        String[] lines = historyJson.split('\n');
        String lastAssistant = null;
        for (String line : lines) {
            if (line.startsWith('Assistant: ')) {
                lastAssistant = line.removeStart('Assistant: ');
            }
        }
        return lastAssistant;
    }

    private static Boolean isKnownCommand(String msg) {
        List<String> commands = new List<String>{
            'help', 'catalog', 'summarize', 'summary', 'analyze', 'analysis',
            'search', 'find', 'add ', 'remove', 'delete', 'submit', 'create a quote',
            'create quote', 'new quote', 'recommend', 'apply discount', 'change quantity',
            'update quantity', 'discount', 'reduce price'
        };
        for (String cmd : commands) {
            if (msg.startsWith(cmd)) return true;
        }
        return false;
    }

    private static Map<String, Object> searchAndShowAccounts(String searchTerm) {
        String searchLike = '%' + String.escapeSingleQuotes(searchTerm.trim()) + '%';
        List<Account> matched = [
            SELECT Id, Name, Industry
            FROM Account
            WHERE Name LIKE :searchLike
            ORDER BY Name
            LIMIT 20
        ];

        if (matched.size() == 1) {
            Map<String, Object> actionData = new Map<String, Object>{
                'itemId' => matched[0].Id,
                'itemType' => 'Account'
            };
            return handleSelectAccount(actionData);
        }

        List<Map<String, Object>> options = new List<Map<String, Object>>();

        if (matched.isEmpty()) {
            List<Account> allAccounts = [
                SELECT Id, Name, Industry
                FROM Account
                ORDER BY Name
                LIMIT 50
            ];
            for (Account a : allAccounts) {
                options.add(new Map<String, Object>{
                    'id' => a.Id,
                    'name' => a.Name,
                    'type' => 'Account',
                    'icon' => '🏢',
                    'detail' => a.Industry != null ? a.Industry : 'Account'
                });
            }
        } else {
            for (Account a : matched) {
                options.add(new Map<String, Object>{
                    'id' => a.Id,
                    'name' => a.Name,
                    'type' => 'Account',
                    'icon' => '🏢',
                    'detail' => a.Industry != null ? a.Industry : 'Account'
                });
            }
        }

        options.add(new Map<String, Object>{
            'id' => 'CREATE_NEW_ACCOUNT',
            'name' => '＋ Create New Account',
            'type' => 'NewAccount',
            'icon' => '✨',
            'detail' => 'Create a new account'
        });

        String message = matched.isEmpty()
            ? 'No accounts match "' + searchTerm + '". Select from all accounts or create a new one:'
            : 'I found ' + matched.size() + ' account(s) matching "' + searchTerm + '". Select one:';

        Map<String, Object> response = buildResponse('disambiguation', message, true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'SELECT_ACCOUNT');
        response.put('pendingQuantity', 0);
        return response;
    }

    // ═══════════════════════════════════════════════════════════════
    //  INTENT HANDLERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Handles "Add item" intent with smart disambiguation.
     *              Searches across Resource Roles, Products, and Add-ons.
     *              If multiple matches found, returns disambiguation list.
     */
    private static Map<String, Object> handleAddItem(String userMessage, CPQContext ctx) {
        // Guard: must have a quote
        if (ctx.quote == null) {
            return buildResponse('text', 'Please navigate to a quote first before adding items.', false, null, null, null);
        }

        // Guard: must be Draft
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** and cannot be modified.\nOnly **Draft** quotes can have items added.', false, null, null, null);
        }

        String itemName = extractItemName(userMessage);
        Decimal quantity = extractQuantity(userMessage);

        if (String.isBlank(itemName)) {
            return buildResponse('text',
                'What would you like to add? Try:\n\n' +
                '• **"Add 3 Senior Developers"**\n' +
                '• **"Add React License"**\n' +
                '• **"Add Project Manager"**',
                true, null, null, null);
        }

        // Search all catalog types
        List<CatalogItem> matches = searchCatalog(itemName, ctx);

        // No matches
        if (matches.isEmpty()) {
            return buildResponse('text',
                'I couldn\'t find any items matching **"' + itemName + '"** in the catalog.\n\n' +
                'Try **"search ' + itemName + '"** to browse, or type **"catalog"** to see everything available.',
                true, null, null, null);
        }

        // Exact single match → add directly
        if (matches.size() == 1) {
            Map<String, Object> actionData = new Map<String, Object>{
                'itemId' => matches[0].itemId,
                'itemType' => matches[0].itemType,
                'quantity' => quantity
            };
            return executeAddItem(actionData, ctx);
        }

        // Multiple matches → disambiguation
        List<Map<String, Object>> options = new List<Map<String, Object>>();
        for (CatalogItem item : matches) {
            options.add(new Map<String, Object>{
                'id' => item.itemId,
                'name' => item.name,
                'price' => item.price,
                'type' => item.itemType,
                'icon' => item.icon,
                'detail' => item.detail
            });
        }

        Map<String, Object> response = buildResponse('disambiguation',
            'I found **' + matches.size() + ' items** matching "' + itemName + '".\nWhich one would you like to add?',
            true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'ADD_ITEM');
        response.put('pendingQuantity', quantity);
        return response;
    }

    /**
     * @description Handles item removal from the current quote.
     */
    private static Map<String, Object> handleRemoveItem(String userMessage, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'Please navigate to a quote first.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** and cannot be modified.', false, null, null, null);
        }
        if (ctx.lineItems.isEmpty()) {
            return buildResponse('text', 'This quote has no line items to remove.', true, null, null, null);
        }

        String itemName = extractItemName(userMessage.replaceAll('(?i)^(remove|delete|drop|take out|get rid of|eliminate)\\s+', ''));

        if (String.isBlank(itemName)) {
            // Show all items for selection
            List<Map<String, Object>> options = new List<Map<String, Object>>();
            for (Quote_Line_Item__c qli : ctx.lineItems) {
                options.add(new Map<String, Object>{
                    'id' => qli.Id,
                    'name' => nn(qli.Name__c),
                    'price' => qli.Net_Total__c,
                    'type' => nn(qli.Item_Type__c),
                    'icon' => getIconForType(nn(qli.Item_Type__c)),
                    'detail' => qli.Quantity__c?.intValue() + 'x @ $' + fmtDec(qli.Unit_Price__c)
                });
            }
            Map<String, Object> response = buildResponse('disambiguation',
                'Which item would you like to remove?',
                true, null, null, null);
            response.put('options', options);
            response.put('pendingAction', 'REMOVE_ITEM');
            response.put('pendingQuantity', 0);
            return response;
        }

        // Find matching line item
        String lower = itemName.toLowerCase();
        List<Quote_Line_Item__c> matchedItems = new List<Quote_Line_Item__c>();
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (nn(qli.Name__c).toLowerCase().contains(lower)) {
                matchedItems.add(qli);
            }
        }

        if (matchedItems.isEmpty()) {
            return buildResponse('text', 'I couldn\'t find **"' + itemName + '"** in the current line items.', true, null, null, null);
        }

        if (matchedItems.size() == 1) {
            Map<String, Object> actionData = new Map<String, Object>{ 'lineItemId' => matchedItems[0].Id };
            return executeRemoveItem(actionData, ctx);
        }

        // Multiple matches
        List<Map<String, Object>> options = new List<Map<String, Object>>();
        for (Quote_Line_Item__c qli : matchedItems) {
            options.add(new Map<String, Object>{
                'id' => qli.Id,
                'name' => nn(qli.Name__c),
                'price' => qli.Net_Total__c,
                'type' => nn(qli.Item_Type__c),
                'icon' => getIconForType(nn(qli.Item_Type__c)),
                'detail' => qli.Quantity__c?.intValue() + 'x @ $' + fmtDec(qli.Unit_Price__c)
            });
        }
        Map<String, Object> response = buildResponse('disambiguation',
            'Multiple items match "' + itemName + '". Which one should I remove?',
            true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'REMOVE_ITEM');
        response.put('pendingQuantity', 0);
        return response;
    }

    /**
     * @description Strategy 3+4: Handles discount intent with slot-filling and policy guardrails.
     *              Asks for missing info instead of failing.
     */
    private static Map<String, Object> handleApplyDiscount(String userMessage, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'Please navigate to a quote first before applying discounts.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** and cannot be modified.', false, null, null, null);
        }
        if (ctx.lineItems.isEmpty()) {
            return buildResponse('text', 'This quote has no items to discount. Add line items first.', true, null, null, null);
        }

        // Extract discount percentage
        Decimal discountPct = extractDiscountPercent(userMessage);

        // Slot filling: if no percentage, ask for it
        if (discountPct == null) {
            return buildResponse('text', '🏷️ What discount percentage would you like to apply?\\n\\nExample: **"Apply 15% discount on Senior Developer"**', true, null, null, null);
        }

        // Try to match an item name
        String itemName = extractItemName(userMessage.replaceAll('(?i)(apply|give|add|set)\\s+(a\\s+)?\\d+\\.?\\d*\\s*(%|percent)\\s*(discount)?\\s*(on|to|for)?\\s*', '').trim());

        // If no item specified, show all line items to choose from
        if (String.isBlank(itemName)) {
            List<Map<String, Object>> options = new List<Map<String, Object>>();
            for (Quote_Line_Item__c qli : ctx.lineItems) {
                options.add(new Map<String, Object>{
                    'id' => qli.Id,
                    'name' => nn(qli.Name__c),
                    'price' => qli.Net_Total__c,
                    'type' => nn(qli.Item_Type__c),
                    'icon' => getIconForType(nn(qli.Item_Type__c)),
                    'detail' => 'Current: $' + fmtDec(qli.Unit_Price__c) + ' · Discount: ' + fmtDec(discountPct) + '%'
                });
            }
            Map<String, Object> response = buildResponse('disambiguation',
                '🏷️ Apply **' + fmtDec(discountPct) + '%** discount to which item?',
                true, null, null, null);
            response.put('options', options);
            response.put('pendingAction', 'APPLY_DISCOUNT');
            response.put('pendingQuantity', discountPct);
            return response;
        }

        // Find matching line item
        String lower = itemName.toLowerCase();
        List<Quote_Line_Item__c> matched = new List<Quote_Line_Item__c>();
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (nn(qli.Name__c).toLowerCase().contains(lower)) matched.add(qli);
        }

        if (matched.isEmpty()) {
            return buildResponse('text', 'I couldn\'t find **"' + itemName + '"** in the current line items.\\nSay **"summarize"** to see all items.', true, null, null, null);
        }

        if (matched.size() == 1) {
            Map<String, Object> actionData = new Map<String, Object>{
                'lineItemId' => matched[0].Id,
                'discountPercent' => discountPct
            };
            return executeApplyDiscount(actionData, ctx);
        }

        // Multiple matches
        List<Map<String, Object>> options = new List<Map<String, Object>>();
        for (Quote_Line_Item__c qli : matched) {
            options.add(new Map<String, Object>{
                'id' => qli.Id,
                'name' => nn(qli.Name__c),
                'price' => qli.Net_Total__c,
                'type' => nn(qli.Item_Type__c),
                'icon' => getIconForType(nn(qli.Item_Type__c)),
                'detail' => 'Discount: ' + fmtDec(discountPct) + '%'
            });
        }
        Map<String, Object> response = buildResponse('disambiguation',
            'Multiple items match. Apply **' + fmtDec(discountPct) + '%** discount to which one?',
            true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'APPLY_DISCOUNT');
        response.put('pendingQuantity', discountPct);
        return response;
    }

    /**
     * @description Strategy 3: Handles quantity update intent with slot-filling.
     */
    private static Map<String, Object> handleUpdateQuantity(String userMessage, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'Please navigate to a quote first.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** and cannot be modified.', false, null, null, null);
        }
        if (ctx.lineItems.isEmpty()) {
            return buildResponse('text', 'This quote has no items. Add line items first.', true, null, null, null);
        }

        Decimal newQty = extractNewQuantity(userMessage);

        if (newQty == null) {
            return buildResponse('text', '🔢 What should the new quantity be?\\n\\nExample: **"Change quantity of Senior Developer to 5"**', true, null, null, null);
        }

        String itemName = extractItemName(userMessage.replaceAll('(?i)(change|update|adjust|modify|set|increase|decrease)\\s+(?:the\\s+)?(?:quantity|qty)\\s*(?:of|for)?\\s*', '').replaceAll('(?i)\\s*(?:to|=)\\s*\\d+.*$', '').trim());

        if (String.isBlank(itemName)) {
            List<Map<String, Object>> options = new List<Map<String, Object>>();
            for (Quote_Line_Item__c qli : ctx.lineItems) {
                options.add(new Map<String, Object>{
                    'id' => qli.Id,
                    'name' => nn(qli.Name__c),
                    'price' => qli.Net_Total__c,
                    'type' => nn(qli.Item_Type__c),
                    'icon' => getIconForType(nn(qli.Item_Type__c)),
                    'detail' => 'Current Qty: ' + qli.Quantity__c?.intValue() + ' → New: ' + newQty.intValue()
                });
            }
            Map<String, Object> response = buildResponse('disambiguation',
                '🔢 Update quantity to **' + newQty.intValue() + '** for which item?',
                true, null, null, null);
            response.put('options', options);
            response.put('pendingAction', 'UPDATE_QUANTITY');
            response.put('pendingQuantity', newQty);
            return response;
        }

        String lower = itemName.toLowerCase();
        List<Quote_Line_Item__c> matched = new List<Quote_Line_Item__c>();
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (nn(qli.Name__c).toLowerCase().contains(lower)) matched.add(qli);
        }

        if (matched.isEmpty()) {
            return buildResponse('text', 'I couldn\'t find **"' + itemName + '"** in the current line items.', true, null, null, null);
        }

        if (matched.size() == 1) {
            Map<String, Object> actionData = new Map<String, Object>{
                'lineItemId' => matched[0].Id,
                'quantity' => newQty
            };
            return executeUpdateQuantity(actionData, ctx);
        }

        List<Map<String, Object>> options = new List<Map<String, Object>>();
        for (Quote_Line_Item__c qli : matched) {
            options.add(new Map<String, Object>{
                'id' => qli.Id,
                'name' => nn(qli.Name__c),
                'price' => qli.Net_Total__c,
                'type' => nn(qli.Item_Type__c),
                'icon' => getIconForType(nn(qli.Item_Type__c)),
                'detail' => 'Current: ' + qli.Quantity__c?.intValue() + ' → ' + newQty.intValue()
            });
        }
        Map<String, Object> response = buildResponse('disambiguation',
            'Multiple items match. Update quantity for which one?',
            true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'UPDATE_QUANTITY');
        response.put('pendingQuantity', newQty);
        return response;
    }

    /**
     * @description Provides a comprehensive, structured quote summary with
     *              financial metrics, line item breakdown, and health indicators.
     */
    private static Map<String, Object> handleSummarize(CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'No quote is currently open. Navigate to a quote to see its summary.', true, null, null, null);
        }

        Quote__c q = ctx.quote;
        String iso = q.CurrencyIsoCode != null ? q.CurrencyIsoCode : 'USD';

        // Margin health
        String marginHealth = '';
        if (q.Margin_Percent__c != null) {
            if (q.Margin_Percent__c >= 40) marginHealth = '🟢 Healthy';
            else if (q.Margin_Percent__c >= ctx.marginThreshold) marginHealth = '🟡 Moderate';
            else marginHealth = '🔴 Below Threshold';
        }

        // Count by type
        Integer roleCount = 0, prodCount = 0, addonCount = 0;
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (qli.Item_Type__c == 'Resource Role') roleCount++;
            else if (qli.Item_Type__c == 'Product') prodCount++;
            else if (qli.Item_Type__c == 'Add-on') addonCount++;
        }

        String msg = '📊 **Quote Summary — ' + q.Name + '**\n\n';

        // Status & Account
        msg += '**Status:** ' + nn(q.Status__c);
        if (q.Account__r != null) msg += ' · **Account:** ' + q.Account__r.Name;
        msg += '\n\n';

        // Financials
        msg += '💰 **Financials (' + iso + ')**\n';
        msg += '• Revenue: **$' + fmtDec(q.Total_Amount__c) + '**\n';
        msg += '• Cost: $' + fmtDec(q.Total_Cost__c) + '\n';
        msg += '• Margin: **' + fmtDec(q.Margin_Percent__c) + '%** ' + marginHealth + '\n';
        msg += '• Margin Amount: $' + fmtDec(q.Margin_Amount__c) + '\n\n';

        // Line items
        msg += '📦 **Line Items (' + ctx.lineItems.size() + ')**\n';
        if (roleCount > 0) msg += '• Resource Roles: ' + roleCount + '\n';
        if (prodCount > 0) msg += '• Products: ' + prodCount + '\n';
        if (addonCount > 0) msg += '• Add-ons: ' + addonCount + '\n';

        if (!ctx.lineItems.isEmpty()) {
            msg += '\n';
            for (Quote_Line_Item__c qli : ctx.lineItems) {
                msg += '  ' + qli.Quantity__c?.intValue() + 'x **' + nn(qli.Name__c) + '** — $' + fmtDec(qli.Net_Total__c) + '\n';
            }
        }

        // Dates
        if (q.Start_Date__c != null || q.End_Date__c != null) {
            msg += '\n📅 ';
            if (q.Start_Date__c != null) msg += String.valueOf(q.Start_Date__c);
            if (q.End_Date__c != null) msg += ' → ' + String.valueOf(q.End_Date__c);
            msg += '\n';
        }

        // Build summary data for structured rendering
        Map<String, Object> summaryData = new Map<String, Object>{
            'quoteName' => q.Name,
            'status' => nn(q.Status__c),
            'account' => q.Account__r != null ? q.Account__r.Name : 'N/A',
            'totalAmount' => q.Total_Amount__c,
            'totalCost' => q.Total_Cost__c,
            'marginPercent' => q.Margin_Percent__c,
            'marginAmount' => q.Margin_Amount__c,
            'lineItemCount' => ctx.lineItems.size(),
            'marginHealth' => marginHealth,
            'currency' => iso
        };

        Map<String, Object> resp = buildResponse('summary', msg, true, null, null, null);
        resp.put('data', summaryData);
        return resp;
    }

    /**
     * @description Searches the entire catalog and returns structured results.
     */
    private static Map<String, Object> handleSearch(String userMessage, CPQContext ctx) {
        String searchTerm = extractSearchTerm(userMessage);
        if (String.isBlank(searchTerm)) {
            // Show full catalog summary
            String msg = '📚 **Full Catalog Overview**\n\n';
            msg += '👤 **Resource Roles** (' + ctx.resourceRoles.size() + ')\n';
            for (Resource_Role__c r : ctx.resourceRoles) {
                msg += '  • ' + r.Name + ' — $' + fmtDec(r.Price__c) + '/hr\n';
            }
            msg += '\n📦 **Products** (' + ctx.products.size() + ')\n';
            for (Product__c p : ctx.products) {
                msg += '  • ' + p.Name + ' — $' + fmtDec(p.Price__c) + '\n';
            }
            if (!ctx.addOns.isEmpty()) {
                msg += '\n➕ **Add-ons** (' + ctx.addOns.size() + ')\n';
                for (Add_On__c a : ctx.addOns) {
                    msg += '  • ' + a.Name + ' — $' + fmtDec(a.Price__c) + '\n';
                }
            }
            msg += '\nTo add any item, say **"Add [item name]"**.';
            return buildResponse('text', msg, true, null, null, null);
        }

        List<CatalogItem> results = searchCatalog(searchTerm, ctx);

        if (results.isEmpty()) {
            return buildResponse('text', 'No items found matching **"' + searchTerm + '"**.\nTry a different keyword or type **"catalog"** to browse everything.', true, null, null, null);
        }

        String msg = '🔍 **Search results for "' + searchTerm + '"** (' + results.size() + ' found)\n\n';
        for (CatalogItem item : results) {
            msg += item.icon + ' **' + item.name + '** — ' + item.detail + ' (' + item.itemType + ')\n';
        }
        msg += '\nSay **"Add [name]"** to add any of these to the quote.';

        return buildResponse('text', msg, true, null, null, null);
    }

    /**
     * @description Provides smart recommendations based on current quote contents.
     */
    private static Map<String, Object> handleRecommend(CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'Open a quote to get personalized recommendations.', true, null, null, null);
        }

        // Gather existing item IDs
        Set<Id> existingIds = new Set<Id>();
        Boolean hasRoles = false, hasProducts = false;
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (qli.Resource_Role__c != null) { existingIds.add(qli.Resource_Role__c); hasRoles = true; }
            if (qli.Product__c != null) { existingIds.add(qli.Product__c); hasProducts = true; }
            if (qli.Add_On__c != null) existingIds.add(qli.Add_On__c);
        }

        List<String> suggestions = new List<String>();

        // Suggest roles not yet added
        if (hasRoles || ctx.lineItems.isEmpty()) {
            for (Resource_Role__c r : ctx.resourceRoles) {
                if (!existingIds.contains(r.Id)) {
                    suggestions.add('👤 **' + r.Name + '** — $' + fmtDec(r.Price__c) + '/hr');
                    if (suggestions.size() >= 3) break;
                }
            }
        }

        // Suggest products
        if (hasProducts || !hasRoles) {
            Integer count = 0;
            for (Product__c p : ctx.products) {
                if (!existingIds.contains(p.Id) && count < 3) {
                    suggestions.add('📦 **' + p.Name + '** — $' + fmtDec(p.Price__c));
                    count++;
                }
            }
        }

        // Suggest add-ons
        Integer addonCount = 0;
        for (Add_On__c a : ctx.addOns) {
            if (!existingIds.contains(a.Id) && addonCount < 2) {
                suggestions.add('➕ **' + a.Name + '** — $' + fmtDec(a.Price__c));
                addonCount++;
            }
        }

        if (suggestions.isEmpty()) {
            return buildResponse('text', '✨ You\'ve already covered the full catalog! This quote looks comprehensive.', true, null, null, null);
        }

        String msg = '💡 **Recommended Additions**\n\n';
        msg += String.join(suggestions, '\n');
        msg += '\n\nSay **"Add [item name]"** to include any of these.';

        return buildResponse('text', msg, true, null, null, null);
    }

    /**
     * @description Submits the quote for approval with pre-flight analysis.
     */
    private static Map<String, Object> handleSubmit(CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'No quote is currently open.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '**. Only Draft quotes can be submitted.', false, null, null, null);
        }
        if (ctx.lineItems.isEmpty()) {
            return buildResponse('text', '⚠️ Cannot submit an empty quote. Add line items first.', false, null, null, null);
        }

        // Pre-flight analysis
        Decimal margin = ctx.quote.Margin_Percent__c != null ? ctx.quote.Margin_Percent__c : 0;
        Boolean willAutoApprove = margin >= ctx.marginThreshold;

        String msg = '📋 **Pre-Submission Analysis**\n\n';
        msg += '• Margin: **' + fmtDec(margin) + '%**';
        msg += margin >= ctx.marginThreshold ? ' 🟢\n' : ' 🔴 Below ' + ctx.marginThreshold + '% threshold\n';
        msg += '• Line Items: **' + ctx.lineItems.size() + '**\n';
        msg += '• Total Amount: **$' + fmtDec(ctx.quote.Total_Amount__c) + '**\n\n';

        if (willAutoApprove) {
            msg += '⚡ Margin meets threshold — this quote will be **auto-approved**.';
        } else {
            msg += '📤 Margin is below threshold — will be routed to **manager for review**.';
        }

        // Execute submission
        QuoteController.submitForApproval(ctx.quote.Id);

        // Re-query status
        Quote__c updated = [SELECT Status__c FROM Quote__c WHERE Id = :ctx.quote.Id LIMIT 1];
        msg += '\n\n✅ **Quote submitted!** New status: **' + updated.Status__c + '**';

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    /**
     * @description Provides intelligent quote analysis — margin health,
     *              pricing insights, and approval likelihood.
     */
    private static Map<String, Object> handleAnalyze(CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'No quote is open. Navigate to a quote for analysis.', true, null, null, null);
        }

        Quote__c q = ctx.quote;
        Decimal margin = q.Margin_Percent__c != null ? q.Margin_Percent__c : 0;
        Decimal revenue = q.Total_Amount__c != null ? q.Total_Amount__c : 0;
        Decimal cost = q.Total_Cost__c != null ? q.Total_Cost__c : 0;

        String msg = '\uD83E\uDDE0 **Quote Analysis \u2014 ' + q.Name + '**\\n\\n';

        // Margin Health
        msg += '**Margin Health**\\n';
        if (margin >= 40) {
            msg += '\uD83D\uDFE2 **Excellent** (' + fmtDec(margin) + '%) \u2014 Well above the ' + ctx.marginThreshold + '% threshold.\\n';
        } else if (margin >= ctx.marginThreshold) {
            msg += '\uD83D\uDFE1 **Adequate** (' + fmtDec(margin) + '%) \u2014 Above threshold but room for improvement.\\n';
        } else if (margin >= 0) {
            msg += '\uD83D\uDD34 **Critical** (' + fmtDec(margin) + '%) \u2014 Below the ' + ctx.marginThreshold + '% minimum threshold.\\n';
        } else {
            msg += '\uD83D\uDD34 **Negative** (' + fmtDec(margin) + '%) \u2014 This quote is losing money.\\n';
        }

        // Approval Likelihood
        msg += '\\n**Approval Likelihood**\\n';
        if (margin >= ctx.marginThreshold) {
            msg += '\u26A1 **Auto-Approve** \u2014 Margin meets the minimum threshold.\\n';
        } else {
            msg += '\uD83D\uDCE4 **Requires Manager Review** \u2014 Will need manual approval.\\n';
        }

        // Strategy 7: Deep Line Item Analysis
        if (!ctx.lineItems.isEmpty()) {
            msg += '\\n**\uD83D\uDCE6 Line Item Breakdown**\\n';

            Quote_Line_Item__c highestMarginItem = null;
            Quote_Line_Item__c lowestMarginItem = null;
            Quote_Line_Item__c highestCostItem = null;
            Decimal highestMargin = -999;
            Decimal lowestMargin = 999;
            Decimal highestCostVal = 0;
            Decimal totalDiscount = 0;
            Integer discountedCount = 0;
            Integer zeroCostCount = 0;
            Integer highQtyCount = 0;

            for (Quote_Line_Item__c qli : ctx.lineItems) {
                Decimal lineRevenue = qli.Net_Total__c != null ? qli.Net_Total__c : 0;
                Decimal lineCost = qli.Total_Line_Cost__c != null ? qli.Total_Line_Cost__c : 0;
                Decimal lineMargin = lineRevenue > 0 ? ((lineRevenue - lineCost) / lineRevenue) * 100 : 0;

                if (lineMargin > highestMargin) { highestMargin = lineMargin; highestMarginItem = qli; }
                if (lineMargin < lowestMargin) { lowestMargin = lineMargin; lowestMarginItem = qli; }
                if (lineCost > highestCostVal) { highestCostVal = lineCost; highestCostItem = qli; }

                if (qli.Discount_Percent__c != null && qli.Discount_Percent__c > 0) {
                    discountedCount++;
                    totalDiscount += qli.Discount_Percent__c;
                }

                if (lineCost == 0 && lineRevenue > 0) zeroCostCount++;
                if (qli.Quantity__c != null && qli.Quantity__c > 10) highQtyCount++;
            }

            if (highestMarginItem != null) {
                msg += '\u2022 Best margin: **' + nn(highestMarginItem.Name__c) + '** (' + fmtDec(highestMargin) + '%)\\n';
            }
            if (lowestMarginItem != null && lowestMarginItem.Id != highestMarginItem?.Id) {
                msg += '\u2022 Lowest margin: **' + nn(lowestMarginItem.Name__c) + '** (' + fmtDec(lowestMargin) + '%)';
                if (lowestMargin < ctx.marginThreshold) msg += ' \u26A0\uFE0F';
                msg += '\\n';
            }

            // Cost Driver Analysis
            if (highestCostItem != null) {
                Decimal costPct = cost > 0 ? (highestCostVal / cost * 100) : 0;
                msg += '\\n**\uD83D\uDCB0 Cost Driver**\\n';
                msg += '\u2022 **' + nn(highestCostItem.Name__c) + '** accounts for **' + fmtDec(costPct) + '%** of total cost ($' + fmtDec(highestCostVal) + ')\\n';
            }

            // Discount Exposure
            if (discountedCount > 0) {
                Decimal avgDiscount = totalDiscount / discountedCount;
                msg += '\\n**\uD83C\uDFF7\uFE0F Discount Exposure**\\n';
                msg += '\u2022 ' + discountedCount + ' of ' + ctx.lineItems.size() + ' items have discounts\\n';
                msg += '\u2022 Average discount: **' + fmtDec(avgDiscount) + '%**\\n';
            }

            // Risk Flags
            List<String> risks = new List<String>();
            if (zeroCostCount > 0) risks.add('\u26A0\uFE0F **' + zeroCostCount + ' items** have no cost data \u2014 margin may be inaccurate');
            if (highQtyCount > 0) risks.add('\uD83D\uDCCA **' + highQtyCount + ' items** have quantity > 10 \u2014 verify these are correct');
            if (margin < 0) risks.add('\u26D4 **Negative margin** \u2014 this quote loses money');
            if (ctx.lineItems.size() == 1) risks.add('\uD83D\uDCA1 Only 1 line item \u2014 consider adding more for a comprehensive quote');

            if (!risks.isEmpty()) {
                msg += '\\n**\uD83D\uDEA9 Risk Flags**\\n';
                for (String risk : risks) {
                    msg += '\u2022 ' + risk + '\\n';
                }
            }

            // Revenue Concentration
            if (ctx.lineItems.size() > 1 && revenue > 0) {
                Decimal topItemRevenue = 0;
                String topItemName = '';
                for (Quote_Line_Item__c qli : ctx.lineItems) {
                    Decimal lr = qli.Net_Total__c != null ? qli.Net_Total__c : 0;
                    if (lr > topItemRevenue) {
                        topItemRevenue = lr;
                        topItemName = nn(qli.Name__c);
                    }
                }
                Decimal concentration = (topItemRevenue / revenue) * 100;
                if (concentration > 60) {
                    msg += '\\n**\uD83D\uDCCA Revenue Concentration**\\n';
                    msg += '\u2022 **' + topItemName + '** represents **' + fmtDec(concentration) + '%** of total revenue\\n';
                    msg += '\u2022 High concentration \u2014 consider diversifying the quote\\n';
                }
            }
        }

        // Build insight data
        Map<String, Object> insightData = new Map<String, Object>{
            'marginPercent' => margin,
            'marginThreshold' => ctx.marginThreshold,
            'approvalLikelihood' => margin >= ctx.marginThreshold ? 'Auto-Approve' : 'Manager Review',
            'healthStatus' => margin >= 40 ? 'excellent' : (margin >= ctx.marginThreshold ? 'adequate' : 'critical')
        };

        Map<String, Object> resp = buildResponse('insight', msg, true, null, null, null);
        resp.put('data', insightData);
        return resp;
    }


    /**
     * @description Answers specific questions about the current quote.
     */
    private static Map<String, Object> handleQuoteDetails(String userMessage, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'No quote is currently open.', true, null, null, null);
        }

        Quote__c q = ctx.quote;
        String msg = userMessage.toLowerCase();
        String answer = '';

        if (msg.contains('who created') || msg.contains('created by')) {
            answer = '👤 Created by **' + nn(q.CreatedBy?.Name) + '** on ' + (q.CreatedDate != null ? q.CreatedDate.format('MMM d, yyyy') : 'N/A');
        } else if (msg.contains('status')) {
            answer = 'Current status: **' + nn(q.Status__c) + '**';
        } else if (msg.contains('account')) {
            answer = 'Account: **' + (q.Account__r != null ? q.Account__r.Name : 'No account linked') + '**';
        } else if (msg.contains('opportunity')) {
            answer = 'Opportunity: **' + (q.Opportunity__r != null ? q.Opportunity__r.Name : 'No opportunity linked') + '**';
        } else if (msg.contains('total') || msg.contains('amount')) {
            answer = 'Total Amount: **$' + fmtDec(q.Total_Amount__c) + '**\nTotal Cost: **$' + fmtDec(q.Total_Cost__c) + '**\nMargin: **' + fmtDec(q.Margin_Percent__c) + '%**';
        } else if (msg.contains('how many') && (msg.contains('item') || msg.contains('line'))) {
            answer = 'This quote has **' + ctx.lineItems.size() + ' line items**.';
        } else if (msg.contains('start date')) {
            answer = 'Start Date: **' + (q.Start_Date__c != null ? String.valueOf(q.Start_Date__c) : 'Not set') + '**';
        } else if (msg.contains('end date')) {
            answer = 'End Date: **' + (q.End_Date__c != null ? String.valueOf(q.End_Date__c) : 'Not set') + '**';
        } else {
            // General details
            answer = '📋 **' + q.Name + '**\n';
            answer += '• Status: ' + nn(q.Status__c) + '\n';
            answer += '• Account: ' + (q.Account__r != null ? q.Account__r.Name : 'N/A') + '\n';
            answer += '• Total: $' + fmtDec(q.Total_Amount__c) + '\n';
            answer += '• Margin: ' + fmtDec(q.Margin_Percent__c) + '%\n';
            answer += '• Items: ' + ctx.lineItems.size();
        }

        return buildResponse('text', answer, true, null, null, null);
    }

    /**
     * @description Returns help text with all capabilities.
     */
    private static Map<String, Object> handleHelp() {
        String msg = '🤖 **CPQ AI Assistant — Capabilities**\n\n';
        msg += '📝 **Quote Management**\n';
        msg += '  • _"Summarize this quote"_\n';
        msg += '  • _"What\'s the total amount?"_\n';
        msg += '  • _"Who created this quote?"_\n\n';
        msg += '➕ **Add Items**\n';
        msg += '  • _"Add 3 Senior Developers"_\n';
        msg += '  • _"Add developer"_ (shows options)\n';
        msg += '  • _"Add React License"_\n\n';
        msg += '🗑️ **Remove Items**\n';
        msg += '  • _"Remove the Jr Developer"_\n';
        msg += '  • _"Delete"_ (shows all items)\n\n';
        msg += '🔍 **Search & Discover**\n';
        msg += '  • _"Search developer"_\n';
        msg += '  • _"Show me all products"_\n';
        msg += '  • _"What\'s available?"_\n\n';
        msg += '💡 **Recommendations**\n';
        msg += '  • _"What should I add?"_\n';
        msg += '  • _"Suggest items"_\n\n';
        msg += '🧠 **Analysis & Intelligence**\n';
        msg += '  • _"Analyze this quote"_\n';
        msg += '  • _"How is the margin?"_\n';
        msg += '  • _"Will this get approved?"_\n\n';
        msg += '🏷️ **Discounting**\n';
        msg += '  • _"Apply 15% discount on Senior Developer"_\n';
        msg += '  • _"Give discount"_ (I\'ll ask for details)\n';
        msg += '  • _"Reduce price by 20%"_\n\n';
        msg += '🔢 **Quantity Management**\n';
        msg += '  • _"Change quantity of Developer to 5"_\n';
        msg += '  • _"Update quantity"_ (shows items)\n\n';
        msg += '📤 **Approval**\n';
        msg += '  • _"Submit for approval"_\n\n';
        msg += '🛡️ I enforce company discount policies, warn about margin impacts, and respect your permissions.\n';
        msg += '📋 I only modify **Draft** quotes and will negotiate when requests exceed policy limits.';

        return buildResponse('text', msg, true, null, null, null);
    }

    /**
     * @description Handles unrecognized messages with contextual suggestions.
     */
    private static Map<String, Object> handleGeneral(String userMessage, CPQContext ctx) {
        String msg = 'I\'m not sure how to help with that. Here are some things I can do:\n\n';
        if (ctx.quote != null) {
            msg += '• **"Summarize"** — Get a complete quote overview\n';
            msg += '• **"Add [item]"** — Add a product or resource\n';
            msg += '• **"Analyze"** — See margin health and insights\n';
            msg += '• **"Search [keyword]"** — Find items in the catalog\n';
        } else {
            msg += '• **"Search [keyword]"** — Browse the product catalog\n';
            msg += '• **"Catalog"** — See all available items\n';
        }
        msg += '\nType **"help"** for the full list of commands.';

        return buildResponse('text', msg, true, null, null, null);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ACTION EXECUTORS (Strategy 1: Conversational Error Handling)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Executes the add-item action with conversational error handling
     *              and post-action state narrative (Strategy 1 + 6).
     */
    private static Map<String, Object> executeAddItem(Map<String, Object> actionData, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', '📋 No quote is open right now. Navigate to a quote first, or say **"Create a quote"** to start one.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** and cannot be modified. Only Draft quotes can have items added.\\nTo make changes, ask your manager to revert it to Draft.', false, null, null, null);
        }

        Id itemId = (Id) actionData.get('itemId');
        String itemType = (String) actionData.get('itemType');
        Object qtyObj = actionData.get('quantity');
        Decimal quantity = qtyObj != null ? (qtyObj instanceof Decimal ? (Decimal) qtyObj : Decimal.valueOf(String.valueOf(qtyObj))) : 1;

        Quote_Line_Item__c qli = new Quote_Line_Item__c(
            Quote__c = ctx.quote.Id,
            Quantity__c = quantity
        );

        String itemName = '';
        Decimal unitPrice = 0;
        Decimal unitCost = 0;

        if (itemType == 'Resource Role') {
            for (Resource_Role__c r : ctx.resourceRoles) {
                if (r.Id == itemId) {
                    qli.Resource_Role__c = r.Id;
                    qli.Item_Type__c = 'Resource Role';
                    qli.Name__c = r.Name;
                    qli.Unit_Price__c = r.Price__c != null ? r.Price__c : 0;
                    qli.Unit_Cost__c = r.Cost__c != null ? r.Cost__c : 0;
                    qli.Base_Rate__c = r.Price__c != null ? r.Price__c : 0;
                    itemName = r.Name;
                    unitPrice = r.Price__c != null ? r.Price__c : 0;
                    unitCost = r.Cost__c != null ? r.Cost__c : 0;
                    break;
                }
            }
        } else if (itemType == 'Product') {
            for (Product__c p : ctx.products) {
                if (p.Id == itemId) {
                    qli.Product__c = p.Id;
                    qli.Item_Type__c = 'Product';
                    qli.Name__c = p.Name;
                    qli.Unit_Price__c = p.Price__c != null ? p.Price__c : 0;
                    qli.Unit_Cost__c = p.Cost__c != null ? p.Cost__c : 0;
                    qli.Base_Rate__c = p.Price__c != null ? p.Price__c : 0;
                    itemName = p.Name;
                    unitPrice = p.Price__c != null ? p.Price__c : 0;
                    unitCost = p.Cost__c != null ? p.Cost__c : 0;
                    break;
                }
            }
        } else if (itemType == 'Add-on') {
            for (Add_On__c a : ctx.addOns) {
                if (a.Id == itemId) {
                    qli.Add_On__c = a.Id;
                    qli.Item_Type__c = 'Add-on';
                    qli.Name__c = a.Name;
                    qli.Unit_Price__c = a.Price__c != null ? a.Price__c : 0;
                    qli.Unit_Cost__c = a.Cost__c != null ? a.Cost__c : 0;
                    qli.Base_Rate__c = a.Price__c != null ? a.Price__c : 0;
                    itemName = a.Name;
                    unitPrice = a.Price__c != null ? a.Price__c : 0;
                    unitCost = a.Cost__c != null ? a.Cost__c : 0;
                    break;
                }
            }
        }

        if (String.isBlank(itemName)) {
            return buildResponse('text', 'I couldn\'t find that item in the catalog. It may have been deactivated.\\nTry **"search"** to browse available items.', false, null, null, null);
        }

        try {
            insert qli;
            QuoteController.recalculateQuoteTotals(ctx.quote.Id);
        } catch (Exception e) {
            return buildRecoveryResponse(e, 'adding ' + itemName + ' to the quote');
        }

        String msg = '✅ **Added to Quote**\\n\\n';
        msg += '• **Item:** ' + itemName + '\\n';
        msg += '• **Type:** ' + itemType + '\\n';
        msg += '• **Quantity:** ' + quantity.intValue() + '\\n';
        msg += '• **Unit Price:** $' + fmtDec(unitPrice) + '\\n';
        msg += '• **Line Total:** $' + fmtDec(unitPrice * quantity) + '\\n';

        // Strategy 6: State narrative with margin impact
        msg += buildStateNarrative(ctx.quote.Id, ctx.marginThreshold);

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    /**
     * @description Executes the remove-item action with error handling and state feedback.
     */
    private static Map<String, Object> executeRemoveItem(Map<String, Object> actionData, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', '📋 No quote is open. Navigate to a quote first.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** — items cannot be removed.', false, null, null, null);
        }

        Id lineItemId = (Id) actionData.get('lineItemId');
        String removedName = '';
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (qli.Id == lineItemId) {
                removedName = nn(qli.Name__c);
                break;
            }
        }

        try {
            delete [SELECT Id FROM Quote_Line_Item__c WHERE Id = :lineItemId];
            QuoteController.recalculateQuoteTotals(ctx.quote.Id);
        } catch (Exception e) {
            return buildRecoveryResponse(e, 'removing ' + removedName + ' from the quote');
        }

        String msg = '🗑️ **Removed from Quote**\\n\\n';
        msg += '• **Item:** ' + removedName + '\\n';
        msg += buildStateNarrative(ctx.quote.Id, ctx.marginThreshold);

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    /**
     * @description Strategy 4: Applies a discount with policy enforcement and negotiation.
     */
    private static Map<String, Object> executeApplyDiscount(Map<String, Object> actionData, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', '📋 No quote is open.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** — discounts cannot be applied.', false, null, null, null);
        }

        Id lineItemId = (Id) actionData.get('lineItemId');
        Object discObj = actionData.get('discountPercent');
        Decimal requestedDiscount = discObj != null ? Decimal.valueOf(String.valueOf(discObj)) : 0;

        Quote_Line_Item__c target = null;
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (qli.Id == lineItemId) { target = qli; break; }
        }

        if (target == null) {
            return buildResponse('text', 'I couldn\'t find that line item. It may have been removed.', false, null, null, null);
        }

        // Strategy 4: Policy check
        Decimal maxAllowed = getMaxAllowedDiscount(target, ctx);

        if (requestedDiscount > maxAllowed && maxAllowed > 0) {
            String msg = '🛡️ **Policy Limit Reached**\\n\\n';
            msg += '• You requested: **' + fmtDec(requestedDiscount) + '%** discount on **' + nn(target.Name__c) + '**\\n';
            msg += '• Maximum allowed: **' + fmtDec(maxAllowed) + '%**\\n\\n';
            msg += 'Would you like me to apply the maximum **' + fmtDec(maxAllowed) + '%** discount instead?';

            List<Map<String, Object>> options = new List<Map<String, Object>>();
            options.add(new Map<String, Object>{
                'id' => lineItemId,
                'name' => 'Apply ' + fmtDec(maxAllowed) + '% (max allowed)',
                'type' => 'DiscountOption',
                'icon' => '✅',
                'detail' => 'Discount: ' + fmtDec(maxAllowed) + '%'
            });
            options.add(new Map<String, Object>{
                'id' => 'CANCEL',
                'name' => 'Keep current pricing',
                'type' => 'CancelDiscount',
                'icon' => '❌',
                'detail' => 'No discount applied'
            });

            Map<String, Object> response = buildResponse('disambiguation', msg, true, null, null, null);
            response.put('options', options);
            response.put('pendingAction', 'APPLY_DISCOUNT');
            response.put('pendingQuantity', maxAllowed);
            return response;
        }

        if (requestedDiscount > 100 || requestedDiscount < 0) {
            return buildResponse('text', '⚠️ Discount must be between **0%** and **100%**. Please specify a valid percentage.', false, null, null, null);
        }

        try {
            target.Discount_Percent__c = requestedDiscount;
            Decimal basePrice = target.Base_Rate__c != null ? target.Base_Rate__c : target.Unit_Price__c;
            target.Unit_Price__c = basePrice * (1 - (requestedDiscount / 100));
            update target;
            QuoteController.recalculateQuoteTotals(ctx.quote.Id);
        } catch (Exception e) {
            return buildRecoveryResponse(e, 'applying discount to ' + nn(target.Name__c));
        }

        String msg = '✅ **Discount Applied**\\n\\n';
        msg += '• **Item:** ' + nn(target.Name__c) + '\\n';
        msg += '• **Discount:** ' + fmtDec(requestedDiscount) + '%\\n';
        msg += '• **New Price:** $' + fmtDec(target.Unit_Price__c) + '\\n';
        msg += buildStateNarrative(ctx.quote.Id, ctx.marginThreshold);

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    /**
     * @description Updates quantity for a line item with validation.
     */
    private static Map<String, Object> executeUpdateQuantity(Map<String, Object> actionData, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', '📋 No quote is open.', false, null, null, null);
        }
        if (ctx.quote.Status__c != 'Draft') {
            return buildResponse('text', '🔒 This quote is **' + ctx.quote.Status__c + '** — quantities cannot be changed.', false, null, null, null);
        }

        Id lineItemId = (Id) actionData.get('lineItemId');
        Object qtyObj = actionData.get('quantity');
        Decimal newQuantity = qtyObj != null ? Decimal.valueOf(String.valueOf(qtyObj)) : 1;

        Quote_Line_Item__c target = null;
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (qli.Id == lineItemId) { target = qli; break; }
        }

        if (target == null) {
            return buildResponse('text', 'I couldn\'t find that line item.', false, null, null, null);
        }
        if (newQuantity <= 0) {
            return buildResponse('text', '⚠️ Quantity must be greater than 0. Did you mean to **remove** this item instead?', false, null, null, null);
        }

        Decimal oldQuantity = target.Quantity__c;
        try {
            target.Quantity__c = newQuantity;
            update target;
            QuoteController.recalculateQuoteTotals(ctx.quote.Id);
        } catch (Exception e) {
            return buildRecoveryResponse(e, 'updating quantity for ' + nn(target.Name__c));
        }

        String msg = '✅ **Quantity Updated**\\n\\n';
        msg += '• **Item:** ' + nn(target.Name__c) + '\\n';
        msg += '• **Old Qty:** ' + oldQuantity?.intValue() + ' → **New Qty:** ' + newQuantity.intValue() + '\\n';
        msg += '• **New Line Total:** $' + fmtDec(target.Unit_Price__c * newQuantity) + '\\n';
        msg += buildStateNarrative(ctx.quote.Id, ctx.marginThreshold);

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    // ═══════════════════════════════════════════════════════════════
    //  STRATEGY 6: STATE NARRATIVE (Post-Action Health Assessment)
    // ═══════════════════════════════════════════════════════════════

    private static String buildStateNarrative(Id quoteId, Decimal marginThreshold) {
        Quote__c q = [
            SELECT Total_Amount__c, Total_Cost__c, Margin_Percent__c, Margin_Amount__c
            FROM Quote__c WHERE Id = :quoteId LIMIT 1
        ];
        Integer lineCount = [SELECT COUNT() FROM Quote_Line_Item__c WHERE Quote__c = :quoteId];

        String narrative = '\\n\\n📊 **Quote Health Update**\\n';
        Decimal margin = q.Margin_Percent__c != null ? q.Margin_Percent__c : 0;
        Decimal revenue = q.Total_Amount__c != null ? q.Total_Amount__c : 0;

        narrative += '• Total: **$' + fmtDec(revenue) + '** · Margin: **' + fmtDec(margin) + '%**';

        if (margin < 0) {
            narrative += '\\n⛔ **CRITICAL:** This quote is **losing money** (negative margin). Review pricing immediately.';
        } else if (margin < marginThreshold) {
            narrative += '\\n⚠️ **Warning:** Margin dropped below **' + fmtDec(marginThreshold) + '%** threshold. Will require **manager approval**.';
        } else if (margin >= 40) {
            narrative += ' 🟢 Excellent';
        } else {
            narrative += ' 🟡 Above threshold';
        }

        if (lineCount == 0) {
            narrative += '\\n📭 The quote is now **empty** — no line items remaining.';
        }

        return narrative;
    }

    // ═══════════════════════════════════════════════════════════════
    //  STRATEGY 4: DISCOUNT POLICY HELPER
    // ═══════════════════════════════════════════════════════════════

    private static Decimal getMaxAllowedDiscount(Quote_Line_Item__c qli, CPQContext ctx) {
        Decimal maxDiscount = 0;
        Boolean hasTier = false;

        for (Discount_Tier__c tier : ctx.discountTiers) {
            Boolean matches = false;
            if (qli.Product__c != null && tier.Product__c == qli.Product__c) matches = true;
            if (qli.Resource_Role__c != null && tier.Resource_Role__c == qli.Resource_Role__c) matches = true;
            if (qli.Add_On__c != null && tier.Add_On__c == qli.Add_On__c) matches = true;

            if (matches && tier.Discount_Percent__c != null) {
                hasTier = true;
                if (tier.Discount_Percent__c > maxDiscount) {
                    maxDiscount = tier.Discount_Percent__c;
                }
            }
        }

        if (!hasTier) {
            if (ctx.userRole == 'Admin' || ctx.userRole == 'Manager') {
                maxDiscount = 50;
            } else {
                maxDiscount = 25;
            }
        }

        return maxDiscount;
    }

    // ═══════════════════════════════════════════════════════════════
    //  STRATEGY 1: CONVERSATIONAL ERROR RECOVERY
    // ═══════════════════════════════════════════════════════════════

    private static Map<String, Object> buildRecoveryResponse(Exception e) {
        return buildRecoveryResponse(e, null);
    }

    private static Map<String, Object> buildRecoveryResponse(Exception e, String actionContext) {
        String errorMsg = e.getMessage();
        String context = String.isNotBlank(actionContext) ? ' while ' + actionContext : '';
        String msg = '';

        if (errorMsg.containsIgnoreCase('FIELD_CUSTOM_VALIDATION_EXCEPTION')) {
            String ruleMsg = errorMsg.substringAfter('FIELD_CUSTOM_VALIDATION_EXCEPTION,');
            if (String.isNotBlank(ruleMsg)) {
                ruleMsg = ruleMsg.substringBefore(':').trim();
            }
            msg = '🛡️ **Business Rule Violation**' + context + '\\n\\n';
            msg += '**Rule:** ' + (String.isNotBlank(ruleMsg) ? ruleMsg : errorMsg) + '\\n\\n';
            msg += 'Please adjust the data and try again.';
        } else if (errorMsg.containsIgnoreCase('UNABLE_TO_LOCK_ROW')) {
            msg = '⏳ **Record is busy**' + context + '\\n\\n';
            msg += 'Another user is currently editing this record. Please wait a moment and try again.';
        } else if (errorMsg.containsIgnoreCase('DUPLICATE')) {
            msg = '🔄 **Duplicate Detected**' + context + '\\n\\n';
            msg += 'A similar record already exists. Would you like me to search for the existing one instead?';
        } else if (errorMsg.containsIgnoreCase('INSUFFICIENT_ACCESS') || errorMsg.containsIgnoreCase('FIELD_INTEGRITY_EXCEPTION')) {
            msg = '🔐 **Permission Issue**' + context + '\\n\\n';
            msg += 'You may not have the required permissions for this action. Contact your admin if needed.';
        } else if (errorMsg.containsIgnoreCase('REQUIRED_FIELD_MISSING')) {
            msg = '📝 **Missing Required Information**' + context + '\\n\\n';
            msg += 'Some required fields are empty. Please provide all necessary data and try again.';
        } else {
            msg = '⚠️ **Something went wrong**' + context + '\\n\\n';
            msg += '**Details:** ' + errorMsg.abbreviate(200) + '\\n\\n';
            msg += 'Please verify the data and try again, or say **"help"** for guidance.';
        }

        return buildResponse('text', msg, false, null, null, null);
    }

    // ═══════════════════════════════════════════════════════════════
    //  CATALOG SEARCH (Strategy 2: Enhanced Fuzzy Matching)
    // ═══════════════════════════════════════════════════════════════

    private static List<CatalogItem> searchCatalog(String searchTerm, CPQContext ctx) {
        String lower = searchTerm.toLowerCase().trim();
        List<String> searchTokens = lower.split('\\s+');
        List<CatalogItem> matches = new List<CatalogItem>();

        for (Resource_Role__c r : ctx.resourceRoles) {
            if (fuzzyMatch(r.Name, lower, searchTokens)) {
                CatalogItem item = new CatalogItem();
                item.itemId = r.Id;
                item.name = r.Name;
                item.price = r.Price__c;
                item.cost = r.Cost__c;
                item.itemType = 'Resource Role';
                item.icon = '👤';
                item.detail = '$' + fmtDec(r.Price__c) + '/hr';
                item.billingUnit = r.Billing_Unit__c;
                matches.add(item);
            }
        }

        for (Product__c p : ctx.products) {
            if (fuzzyMatch(p.Name, lower, searchTokens)) {
                CatalogItem item = new CatalogItem();
                item.itemId = p.Id;
                item.name = p.Name;
                item.price = p.Price__c;
                item.cost = p.Cost__c;
                item.itemType = 'Product';
                item.icon = '📦';
                item.detail = '$' + fmtDec(p.Price__c);
                item.billingUnit = p.Billing_Unit__c;
                matches.add(item);
            }
        }

        for (Add_On__c a : ctx.addOns) {
            if (fuzzyMatch(a.Name, lower, searchTokens)) {
                CatalogItem item = new CatalogItem();
                item.itemId = a.Id;
                item.name = a.Name;
                item.price = a.Price__c;
                item.cost = a.Cost__c;
                item.itemType = 'Add-on';
                item.icon = '➕';
                item.detail = '$' + fmtDec(a.Price__c);
                item.billingUnit = a.Billing_Unit__c;
                matches.add(item);
            }
        }

        return matches;
    }

    /**
     * @description Strategy 2: Fuzzy matching with word-token overlap for typo tolerance.
     */
    private static Boolean fuzzyMatch(String recordName, String searchLower, List<String> searchTokens) {
        String nameLower = recordName.toLowerCase();
        if (nameLower.contains(searchLower)) return true;

        List<String> nameTokens = nameLower.split('[\\s\\-_]+');
        Integer matchedTokens = 0;

        for (String searchToken : searchTokens) {
            if (searchToken.length() < 2) continue;
            for (String nameToken : nameTokens) {
                if (nameToken == searchToken) { matchedTokens++; break; }
                if (nameToken.contains(searchToken) || searchToken.contains(nameToken)) { matchedTokens++; break; }
                if (Math.abs(nameToken.length() - searchToken.length()) <= 2) {
                    Integer commonChars = countCommonChars(nameToken, searchToken);
                    Integer minLen = Math.min(nameToken.length(), searchToken.length());
                    if (minLen > 0 && commonChars >= minLen - 1) { matchedTokens++; break; }
                }
            }
        }

        return searchTokens.size() > 0 && matchedTokens >= Math.max(1, searchTokens.size() / 2);
    }

    private static Integer countCommonChars(String a, String b) {
        Integer common = 0;
        List<String> bChars = b.split('');
        Set<Integer> used = new Set<Integer>();
        for (String ch : a.split('')) {
            for (Integer i = 0; i < bChars.size(); i++) {
                if (!used.contains(i) && ch == bChars[i]) {
                    common++;
                    used.add(i);
                    break;
                }
            }
        }
        return common;
    }

    // ═══════════════════════════════════════════════════════════════
    //  RESPONSE BUILDERS
    // ═══════════════════════════════════════════════════════════════

    private static Map<String, Object> buildResponse(
        String responseType, String message, Boolean success,
        String action, Id recordId, Map<String, Object> data
    ) {
        Map<String, Object> resp = new Map<String, Object>();
        resp.put('success', success);
        resp.put('responseType', responseType);
        resp.put('message', message);
        if (action != null) resp.put('action', action);
        if (recordId != null) resp.put('recordId', recordId);
        if (data != null) resp.put('data', data);
        return resp;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ENTITY EXTRACTION UTILITIES
    // ═══════════════════════════════════════════════════════════════

    private static Decimal extractQuantity(String message) {
        Pattern p = Pattern.compile('(?i)(?:add|include|insert|get me|i need|i want)\\s+(\\d+)\\s+');
        Matcher m = p.matcher(message);
        if (m.find()) {
            return Decimal.valueOf(m.group(1));
        }
        Pattern p2 = Pattern.compile('(\\d+)\\s+(?!\\.)');
        Matcher m2 = p2.matcher(message);
        if (m2.find()) {
            return Decimal.valueOf(m2.group(1));
        }
        return 1;
    }

    private static String extractItemName(String message) {
        String cleaned = message;
        cleaned = cleaned.replaceAll('(?i)^(add|include|insert|put|throw in|get me|i need|i want|remove|delete|drop|take out|get rid of|eliminate)\\s+', '');
        cleaned = cleaned.replaceAll('^\\d+\\s+', '');
        cleaned = cleaned.replaceAll('(?i)\\s+(to the quote|to quote|to this quote|from the quote|from this quote|please|thanks|thank you|now).*$', '');
        cleaned = cleaned.replaceAll('(?i)^(a |an |the |some )', '');
        cleaned = cleaned.replaceAll('(?i)^(line item|item|items)\\s*', '');
        return cleaned.trim();
    }

    private static String extractSearchTerm(String message) {
        String cleaned = message.replaceAll('(?i)^(search|find|look up|show me|list|show|browse|catalog)\\s*', '');
        cleaned = cleaned.replaceAll('(?i)\\s*(products?|roles?|items?|add-?ons?|catalog)\\s*$', '');
        cleaned = cleaned.replaceAll('(?i)^(for |about |all )', '');
        return cleaned.trim();
    }

    private static Decimal extractDiscountPercent(String message) {
        Pattern p = Pattern.compile('(\\d+\\.?\\d*)\\s*(%|percent)');
        Matcher m = p.matcher(message);
        if (m.find()) return Decimal.valueOf(m.group(1));

        Pattern p2 = Pattern.compile('(?i)discount\\s+(?:of\\s+)?(\\d+\\.?\\d*)');
        Matcher m2 = p2.matcher(message);
        if (m2.find()) return Decimal.valueOf(m2.group(1));

        return null;
    }

    private static Decimal extractNewQuantity(String message) {
        Pattern p = Pattern.compile('(?i)(?:to|=|set to|change to|update to)\\s+(\\d+)');
        Matcher m = p.matcher(message);
        if (m.find()) return Decimal.valueOf(m.group(1));

        Pattern p2 = Pattern.compile('(\\d+)');
        Matcher m2 = p2.matcher(message.replaceAll('\\d+%', ''));
        if (m2.find()) return Decimal.valueOf(m2.group(1));
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  FORMATTING UTILITIES
    // ═══════════════════════════════════════════════════════════════

    private static String fmtDec(Decimal val) {
        if (val == null) return '0.00';
        return val.setScale(2).format();
    }

    private static String nn(String val) {
        return val != null ? val : '';
    }

    private static String getIconForType(String itemType) {
        if (itemType == 'Resource Role') return '👤';
        if (itemType == 'Product') return '📦';
        if (itemType == 'Add-on') return '➕';
        return '📋';
    }



    // ═══════════════════════════════════════════════════════════════
    //  QUOTE CREATION FLOW (Account → Opportunity → Create)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Step 1: Shows account list for the user to select.
     */
    private static Map<String, Object> handleCreateQuote(CPQContext ctx) {
        List<Account> accounts = [
            SELECT Id, Name, Industry
            FROM Account
            ORDER BY Name
            LIMIT 50
        ];

        if (accounts.isEmpty()) {
            return buildResponse('text', 'No accounts found in the org. Please create an account first.', false, null, null, null);
        }

        List<Map<String, Object>> options = new List<Map<String, Object>>();
        for (Account a : accounts) {
            options.add(new Map<String, Object>{
                'id' => a.Id,
                'name' => a.Name,
                'type' => 'Account',
                'icon' => '🏢',
                'detail' => a.Industry != null ? a.Industry : 'Account'
            });
        }

        Map<String, Object> response = buildResponse('disambiguation',
            '📝 **Create New Quote**\n\nWhich account is this quote for?',
            true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'SELECT_ACCOUNT');
        response.put('pendingQuantity', 0);
        return response;
    }

    /**
     * @description Step 2: After account selected, shows opportunities for that
     *              account + a "Create New Opportunity" option.
     */
    private static Map<String, Object> handleSelectAccount(Map<String, Object> actionData) {
        Id accountId = (Id) actionData.get('itemId');
        String accountName = '';

        List<Account> accts = [SELECT Id, Name FROM Account WHERE Id = :accountId LIMIT 1];
        if (!accts.isEmpty()) {
            accountName = accts[0].Name;
        }

        List<Opportunity> opps = [
            SELECT Id, Name, StageName, Amount, CloseDate
            FROM Opportunity
            WHERE AccountId = :accountId
            ORDER BY CreatedDate DESC
            LIMIT 20
        ];

        List<Map<String, Object>> options = new List<Map<String, Object>>();

        // Add existing opportunities
        for (Opportunity opp : opps) {
            String detail = nn(opp.StageName);
            if (opp.Amount != null) detail += ' · $' + fmtDec(opp.Amount);
            options.add(new Map<String, Object>{
                'id' => opp.Id,
                'name' => opp.Name,
                'type' => 'Opportunity',
                'icon' => '💰',
                'detail' => detail,
                'accountId' => accountId
            });
        }

        // Add "Create New Opportunity" option
        options.add(new Map<String, Object>{
            'id' => 'CREATE_NEW',
            'name' => '＋ Create New Opportunity',
            'type' => 'NewOpportunity',
            'icon' => '✨',
            'detail' => 'Auto-create for ' + accountName,
            'accountId' => accountId
        });

        Map<String, Object> response = buildResponse('disambiguation',
            '🏢 Account: **' + accountName + '**\n\nSelect an opportunity to link the quote to:',
            true, null, null, null);
        response.put('options', options);
        response.put('pendingAction', 'SELECT_OPPORTUNITY');
        response.put('pendingQuantity', 0);
        response.put('pendingAccountId', accountId);
        return response;
    }

    /**
     * @description Step 3: Creates the quote. If "Create New" was selected,
     *              also creates a new opportunity.
     */
    private static Map<String, Object> handleSelectOpportunity(Map<String, Object> actionData) {
        Id accountId = (Id) actionData.get('accountId');
        String oppIdStr = (String) actionData.get('itemId');

        if (accountId == null) {
            return buildResponse('text', 'Account context was lost. Please start over with **"Create a quote"**.', false, null, null, null);
        }

        Id opportunityId;

        if (oppIdStr == 'CREATE_NEW') {
            // Create a new opportunity for this account
            Account acct = [SELECT Name FROM Account WHERE Id = :accountId LIMIT 1];
            Opportunity newOpp = new Opportunity(
                Name = acct.Name + ' - Opportunity ' + Date.today().format(),
                AccountId = accountId,
                StageName = 'Prospecting',
                CloseDate = Date.today().addDays(90)
            );
            insert newOpp;
            opportunityId = newOpp.Id;
        } else {
            opportunityId = (Id) oppIdStr;
        }

        return createQuoteRecord(accountId, opportunityId);
    }

    /**
     * @description Fallback handler for direct final creation.
     */
    private static Map<String, Object> handleCreateQuoteFinal(Map<String, Object> actionData) {
        Id accountId = (Id) actionData.get('accountId');
        Id opportunityId = (Id) actionData.get('opportunityId');
        return createQuoteRecord(accountId, opportunityId);
    }

    /**
     * @description Shared logic to insert the Quote__c record and return
     *              a navigation response.
     */
    private static Map<String, Object> createQuoteRecord(Id accountId, Id opportunityId) {
        Quote__c q = new Quote__c(
            Account__c = accountId,
            Opportunity__c = opportunityId,
            Status__c = 'Draft',
            Start_Date__c = Date.today()
        );
        insert q;

        // Re-query to get auto-number name
        q = [SELECT Id, Name, Account__r.Name, Opportunity__r.Name FROM Quote__c WHERE Id = :q.Id LIMIT 1];

        String msg = '✅ **Quote Created Successfully!**\n\n';
        msg += '• **Quote:** ' + q.Name + '\n';
        msg += '• **Account:** ' + q.Account__r.Name + '\n';
        msg += '• **Opportunity:** ' + q.Opportunity__r.Name + '\n';
        msg += '• **Status:** Draft\n\n';
        msg += 'Opening the new quote...';

        Map<String, Object> response = buildResponse('action_result', msg, true, 'NAVIGATE', q.Id, null);
        return response;
    }

    // ═══════════════════════════════════════════════════════════════
    //  LLM OPTION ID RESOLUTION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description LLM-generated options may contain record Names (e.g. "RR-0001")
     *              instead of real Salesforce 18-char IDs. This method resolves
     *              each option to its actual catalog record by matching on name.
     */

    /**
     * @description Creates a new account from the AI conversation.
     */
    private static Map<String, Object> handleCreateAccount(Map<String, Object> actionData) {
        String accountName = (String) actionData.get('accountName');
        if (String.isBlank(accountName)) {
            return buildResponse('text', 'Please provide the account name.', false, null, null, null);
        }

        try {
            Account newAcct = new Account(Name = accountName);
            insert newAcct;

            Map<String, Object> selectData = new Map<String, Object>{
                'itemId' => newAcct.Id,
                'itemType' => 'Account'
            };
            return handleSelectAccount(selectData);
        } catch (Exception e) {
            return buildRecoveryResponse(e, 'creating account "' + accountName + '"');
        }
    }

    private static List<Map<String, Object>> resolveOptionIds(List<Object> rawOptions, CPQContext ctx) {
        List<Map<String, Object>> resolved = new List<Map<String, Object>>();

        for (Object rawOpt : rawOptions) {
            Map<String, Object> opt = (Map<String, Object>) rawOpt;
            String optName = (String) opt.get('name');
            String optId = (String) opt.get('id');

            // Check if the ID looks like a real 15/18 char Salesforce ID
            Boolean isValidId = optId != null && (optId.length() == 15 || optId.length() == 18);
            if (isValidId) {
                try {
                    Id testId = Id.valueOf(optId);
                    // It's a valid Salesforce Id, keep it
                    resolved.add(opt);
                    continue;
                } catch (Exception e) {
                    // Not a valid ID, need to resolve
                }
            }

            // Resolve by matching name against the catalog using Strategy 2: Fuzzy Matching
            Boolean found = false;
            if (String.isNotBlank(optName)) {
                List<CatalogItem> matches = searchCatalog(optName, ctx);
                if (!matches.isEmpty()) {
                    CatalogItem match = matches[0];
                    resolved.add(new Map<String, Object>{
                        'id' => match.itemId,
                        'name' => match.name,
                        'price' => match.price,
                        'type' => match.itemType,
                        'icon' => match.icon,
                        'detail' => match.detail
                    });
                    found = true;
                }
            }

            // If still not found, skip this option (can't resolve the ID)
            if (!found) {
                // Keep it but mark as unresolved so user sees it
                opt.put('detail', '(could not resolve)');
                resolved.add(opt);
            }
        }

        return resolved;
    }
}
