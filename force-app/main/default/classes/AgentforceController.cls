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
                response = processWithEngine(userMessage, ctx);
            }

            return response;
        } catch (Exception e) {
            return buildResponse('text', '⚠️ An error occurred: ' + e.getMessage(), false, null, null, null);
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
            if (actionType == 'SELECT_ACCOUNT') {
                return handleSelectAccount(actionData);
            }
            if (actionType == 'SELECT_OPPORTUNITY') {
                return handleSelectOpportunity(actionData);
            }
            if (actionType == 'CREATE_QUOTE_FINAL') {
                return handleCreateQuoteFinal(actionData);
            }

            return buildResponse('text', 'Unknown action type.', false, null, null, null);
        } catch (Exception e) {
            return buildResponse('text', '⚠️ Action failed: ' + e.getMessage(), false, null, null, null);
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
    private static Map<String, Object> processWithEngine(String userMessage, CPQContext ctx) {
        String msg = userMessage.toLowerCase().trim();
        String intent = detectIntent(msg);

        switch on intent {
            when 'add_item'      { return handleAddItem(userMessage, ctx); }
            when 'remove_item'   { return handleRemoveItem(userMessage, ctx); }
            when 'create_quote'  { return handleCreateQuote(ctx); }
            when 'summarize'     { return handleSummarize(ctx); }
            when 'search'        { return handleSearch(userMessage, ctx); }
            when 'recommend'     { return handleRecommend(ctx); }
            when 'submit'        { return handleSubmit(ctx); }
            when 'analyze'       { return handleAnalyze(ctx); }
            when 'help'          { return handleHelp(); }
            when 'details'       { return handleQuoteDetails(userMessage, ctx); }
            when else            { return handleGeneral(userMessage, ctx); }
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

        String msg = '🧠 **Quote Analysis — ' + q.Name + '**\n\n';

        // Margin Health
        msg += '**Margin Health**\n';
        if (margin >= 40) {
            msg += '🟢 **Excellent** (' + fmtDec(margin) + '%) — Well above the ' + ctx.marginThreshold + '% threshold.\n';
        } else if (margin >= ctx.marginThreshold) {
            msg += '🟡 **Adequate** (' + fmtDec(margin) + '%) — Above threshold but room for improvement.\n';
        } else if (margin >= 0) {
            msg += '🔴 **Critical** (' + fmtDec(margin) + '%) — Below the ' + ctx.marginThreshold + '% minimum threshold.\n';
        } else {
            msg += '🔴 **Negative** (' + fmtDec(margin) + '%) — This quote is losing money.\n';
        }

        // Approval Likelihood
        msg += '\n**Approval Likelihood**\n';
        if (margin >= ctx.marginThreshold) {
            msg += '⚡ **Auto-Approve** — Margin meets the minimum threshold.\n';
        } else {
            msg += '📤 **Requires Manager Review** — Will need manual approval.\n';
        }

        // Line item analysis
        if (!ctx.lineItems.isEmpty()) {
            msg += '\n**Line Item Breakdown**\n';

            // Find highest and lowest margin items
            Quote_Line_Item__c highestMarginItem = null;
            Quote_Line_Item__c lowestMarginItem = null;
            Decimal highestMargin = -999;
            Decimal lowestMargin = 999;

            for (Quote_Line_Item__c qli : ctx.lineItems) {
                Decimal lineRevenue = qli.Net_Total__c != null ? qli.Net_Total__c : 0;
                Decimal lineCost = qli.Total_Line_Cost__c != null ? qli.Total_Line_Cost__c : 0;
                Decimal lineMargin = lineRevenue > 0 ? ((lineRevenue - lineCost) / lineRevenue) * 100 : 0;

                if (lineMargin > highestMargin) { highestMargin = lineMargin; highestMarginItem = qli; }
                if (lineMargin < lowestMargin) { lowestMargin = lineMargin; lowestMarginItem = qli; }
            }

            if (highestMarginItem != null) {
                msg += '• Best margin: **' + nn(highestMarginItem.Name__c) + '** (' + fmtDec(highestMargin) + '%)\n';
            }
            if (lowestMarginItem != null && lowestMarginItem.Id != highestMarginItem?.Id) {
                msg += '• Lowest margin: **' + nn(lowestMarginItem.Name__c) + '** (' + fmtDec(lowestMargin) + '%)';
                if (lowestMargin < ctx.marginThreshold) msg += ' ⚠️';
                msg += '\n';
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
        msg += '📤 **Approval**\n';
        msg += '  • _"Submit for approval"_\n\n';
        msg += '🛡️ I respect your permissions and only modify Draft quotes.';

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
    //  ACTION EXECUTORS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Executes the add-item action (called directly or from disambiguation).
     */
    private static Map<String, Object> executeAddItem(Map<String, Object> actionData, CPQContext ctx) {
        if (ctx.quote == null) {
            return buildResponse('text', 'No quote context available.', false, null, null, null);
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
                    break;
                }
            }
        }

        if (String.isBlank(itemName)) {
            return buildResponse('text', 'Could not find the selected item in the catalog.', false, null, null, null);
        }

        insert qli;
        QuoteController.recalculateQuoteTotals(ctx.quote.Id);

        String msg = '✅ **Added to Quote**\n\n';
        msg += '• **Item:** ' + itemName + '\n';
        msg += '• **Type:** ' + itemType + '\n';
        msg += '• **Quantity:** ' + quantity.intValue() + '\n';
        msg += '• **Unit Price:** $' + fmtDec(unitPrice) + '\n';
        msg += '• **Line Total:** $' + fmtDec(unitPrice * quantity) + '\n';

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    /**
     * @description Executes the remove-item action.
     */
    private static Map<String, Object> executeRemoveItem(Map<String, Object> actionData, CPQContext ctx) {
        Id lineItemId = (Id) actionData.get('lineItemId');

        // Find the item name before deleting
        String removedName = '';
        for (Quote_Line_Item__c qli : ctx.lineItems) {
            if (qli.Id == lineItemId) {
                removedName = nn(qli.Name__c);
                break;
            }
        }

        delete [SELECT Id FROM Quote_Line_Item__c WHERE Id = :lineItemId];
        QuoteController.recalculateQuoteTotals(ctx.quote.Id);

        String msg = '🗑️ **Removed from Quote**\n\n';
        msg += '• **Item:** ' + removedName + '\n';
        msg += '\nQuote totals have been recalculated.';

        return buildResponse('action_result', msg, true, 'REFRESH', null, null);
    }

    // ═══════════════════════════════════════════════════════════════
    //  CATALOG SEARCH
    // ═══════════════════════════════════════════════════════════════

    /**
     * @description Searches across all catalog types using fuzzy matching.
     */
    private static List<CatalogItem> searchCatalog(String searchTerm, CPQContext ctx) {
        String lower = searchTerm.toLowerCase().trim();
        List<CatalogItem> matches = new List<CatalogItem>();

        for (Resource_Role__c r : ctx.resourceRoles) {
            if (r.Name.toLowerCase().contains(lower)) {
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
            if (p.Name.toLowerCase().contains(lower)) {
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
            if (a.Name.toLowerCase().contains(lower)) {
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
        // Also check for "X items" pattern
        Pattern p2 = Pattern.compile('(\\d+)\\s+(?!\\.)');
        Matcher m2 = p2.matcher(message);
        if (m2.find()) {
            return Decimal.valueOf(m2.group(1));
        }
        return 1;
    }

    private static String extractItemName(String message) {
        String cleaned = message;
        // Remove intent verbs
        cleaned = cleaned.replaceAll('(?i)^(add|include|insert|put|throw in|get me|i need|i want|remove|delete|drop|take out|get rid of|eliminate)\\s+', '');
        // Remove quantity
        cleaned = cleaned.replaceAll('^\\d+\\s+', '');
        // Remove trailing context
        cleaned = cleaned.replaceAll('(?i)\\s+(to the quote|to quote|to this quote|from the quote|from this quote|please|thanks|thank you|now).*$', '');
        // Remove articles
        cleaned = cleaned.replaceAll('(?i)^(a |an |the |some )', '');
        // Remove "line item" prefix
        cleaned = cleaned.replaceAll('(?i)^(line item|item|items)\\s*', '');
        return cleaned.trim();
    }

    private static String extractSearchTerm(String message) {
        String cleaned = message.replaceAll('(?i)^(search|find|look up|show me|list|show|browse|catalog)\\s*', '');
        cleaned = cleaned.replaceAll('(?i)\\s*(products?|roles?|items?|add-?ons?|catalog)\\s*$', '');
        cleaned = cleaned.replaceAll('(?i)^(for |about |all )', '');
        return cleaned.trim();
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

            // Resolve by matching name against the catalog
            Boolean found = false;
            if (String.isNotBlank(optName)) {
                String lower = optName.toLowerCase().trim();

                for (Resource_Role__c r : ctx.resourceRoles) {
                    if (r.Name.toLowerCase() == lower) {
                        resolved.add(new Map<String, Object>{
                            'id' => r.Id, 'name' => r.Name,
                            'price' => r.Price__c, 'type' => 'Resource Role',
                            'icon' => '👤', 'detail' => '$' + fmtDec(r.Price__c) + '/hr'
                        });
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (Product__c p : ctx.products) {
                        if (p.Name.toLowerCase() == lower) {
                            resolved.add(new Map<String, Object>{
                                'id' => p.Id, 'name' => p.Name,
                                'price' => p.Price__c, 'type' => 'Product',
                                'icon' => '📦', 'detail' => '$' + fmtDec(p.Price__c)
                            });
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    for (Add_On__c a : ctx.addOns) {
                        if (a.Name.toLowerCase() == lower) {
                            resolved.add(new Map<String, Object>{
                                'id' => a.Id, 'name' => a.Name,
                                'price' => a.Price__c, 'type' => 'Add-on',
                                'icon' => '➕', 'detail' => '$' + fmtDec(a.Price__c)
                            });
                            found = true;
                            break;
                        }
                    }
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
