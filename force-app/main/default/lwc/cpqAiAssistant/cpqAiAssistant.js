import { LightningElement, api, track, wire } from 'lwc';
import processMessage from '@salesforce/apex/AgentforceController.processMessage';
import executeAction from '@salesforce/apex/AgentforceController.executeAction';
import getUserContext from '@salesforce/apex/AgentforceController.getUserContext';

const MAX_HISTORY = 10;

export default class CpqAiAssistant extends LightningElement {
    @api recordId;
    @api quoteData;
    @api lineItems = [];

    @track messages = [];
    @track inputValue = '';
    @track isTyping = false;
    @track userContext = {};

    conversationHistory = [];
    messageIdCounter = 0;

    @wire(getUserContext)
    wiredContext({ data }) {
        if (data) this.userContext = data;
    }

    connectedCallback() {
        this.addAssistantMessage({
            responseType: 'text',
            message: this.buildWelcomeMessage()
        });
    }

    // ═══════════════════════════════════════════════
    //  COMPUTED PROPERTIES
    // ═══════════════════════════════════════════════

    get contextBadge() {
        if (this.quoteData?.Name) {
            return this.quoteData.Name + ' · ' + (this.quoteData.Status__c || 'Draft');
        }
        return 'No quote selected';
    }

    get contextBadgeClass() {
        if (!this.quoteData) return 'context-badge';
        const s = this.quoteData.Status__c;
        if (s === 'Approved') return 'context-badge badge-approved';
        if (s === 'Rejected') return 'context-badge badge-rejected';
        if (s === 'Pending Approval') return 'context-badge badge-pending';
        return 'context-badge badge-draft';
    }

    get userRole() {
        return this.userContext?.role || 'User';
    }

    get quickActions() {
        const actions = [];
        if (this.recordId) {
            actions.push({ key: 'summary', label: '📊 Summary', prompt: 'Summarize this quote' });
            actions.push({ key: 'add', label: '➕ Add Item', prompt: 'Add ' });
            actions.push({ key: 'analyze', label: '🧠 Analyze', prompt: 'Analyze this quote' });
            actions.push({ key: 'recommend', label: '💡 Suggest', prompt: 'What should I add?' });
            if (this.quoteData?.Status__c === 'Draft') {
                actions.push({ key: 'submit', label: '📤 Submit', prompt: 'Submit for approval' });
            }
        }
        actions.push({ key: 'search', label: '🔍 Search', prompt: 'Search ' });
        actions.push({ key: 'help', label: '❓ Help', prompt: 'help' });
        return actions;
    }

    // ═══════════════════════════════════════════════
    //  CONTEXT BUILDERS
    // ═══════════════════════════════════════════════

    buildWelcomeMessage() {
        const name = this.userContext?.userName;
        let welcome = '👋 Hi' + (name ? ' **' + name + '**' : '') + '! I\'m your CPQ AI Assistant.\n\n';

        if (this.quoteData) {
            welcome += '📋 I can see you\'re viewing **' + this.quoteData.Name + '** (' + (this.quoteData.Status__c || 'Draft') + ').\n';
            const itemCount = this.lineItems?.length || 0;
            welcome += '📦 ' + itemCount + ' line item' + (itemCount !== 1 ? 's' : '') + ' on this quote.\n\n';
            welcome += 'I have full awareness of this quote\'s details, line items, and your entire product catalog.\n\n';
        } else {
            welcome += 'I have access to your full product catalog and can help you manage quotes.\n\n';
        }

        welcome += 'Type **help** to see everything I can do, or just ask naturally!';
        return welcome;
    }

    buildPageContext() {
        const ctx = {};
        if (this.quoteData) {
            ctx.quoteName = this.quoteData.Name;
            ctx.status = this.quoteData.Status__c;
            ctx.totalAmount = this.quoteData.Total_Amount__c;
            ctx.totalCost = this.quoteData.Total_Cost__c;
            ctx.marginPercent = this.quoteData.Margin_Percent__c;
            ctx.account = this.quoteData.Account__r?.Name;
            ctx.lineItemCount = this.lineItems?.length || 0;
        }
        return JSON.stringify(ctx);
    }

    buildConversationHistoryString() {
        return this.conversationHistory
            .slice(-MAX_HISTORY)
            .map(m => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.text)
            .join('\n');
    }

    // ═══════════════════════════════════════════════
    //  EVENT HANDLERS
    // ═══════════════════════════════════════════════

    handleQuickAction(event) {
        const prompt = event.currentTarget.dataset.prompt;
        if (prompt === 'Add ' || prompt === 'Search ') {
            this.inputValue = prompt;
            const input = this.template.querySelector('.chat-input');
            if (input) input.focus();
        } else {
            this.inputValue = prompt;
            this.handleSend();
        }
    }

    handleInputChange(event) {
        this.inputValue = event.target.value;
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSend();
        }
    }

    // ═══════════════════════════════════════════════
    //  MESSAGE PROCESSING
    // ═══════════════════════════════════════════════

    async handleSend() {
        const msg = this.inputValue.trim();
        if (!msg) return;

        this.addUserMessage(msg);
        this.conversationHistory.push({ role: 'user', text: msg });
        this.inputValue = '';
        this.isTyping = true;
        this.scrollToBottom();

        try {
            const result = await processMessage({
                userMessage: msg,
                quoteId: this.recordId || null,
                pageContextJson: this.buildPageContext(),
                conversationHistoryJson: this.buildConversationHistoryString()
            });

            this.isTyping = false;

            if (result) {
                this.addAssistantMessage(result);
                this.conversationHistory.push({ role: 'assistant', text: result.message || '' });

                if (result.action === 'REFRESH') {
                    this.dispatchEvent(new CustomEvent('refresh'));
                }
                if (result.action === 'NAVIGATE' && result.recordId) {
                    this.dispatchEvent(new CustomEvent('navigate', { detail: { recordId: result.recordId } }));
                }
            }
        } catch (error) {
            this.isTyping = false;
            const errMsg = error.body?.message || error.message || 'An unexpected error occurred.';
            this.addAssistantMessage({ responseType: 'text', message: '⚠️ ' + errMsg, success: false });
        }

        this.scrollToBottom();
    }

    /**
     * Handles a disambiguation option selection.
     * Calls executeAction directly rather than sending a text message.
     */
    async handleOptionSelect(event) {
        const optionId = event.currentTarget.dataset.id;
        const optionType = event.currentTarget.dataset.type;
        const optionName = event.currentTarget.dataset.name;
        const optionAccountId = event.currentTarget.dataset.accountid || '';

        // Find the pending action from the last disambiguation message
        const lastDisambiguation = [...this.messages].reverse().find(m => m.responseType === 'disambiguation');
        if (!lastDisambiguation) return;

        const actionType = lastDisambiguation.pendingAction;
        const quantity = lastDisambiguation.pendingQuantity || 1;
        const pendingAccountId = lastDisambiguation.pendingAccountId || optionAccountId;

        // Show user's selection as a message
        this.addUserMessage(optionName);
        this.isTyping = true;
        this.scrollToBottom();

        try {
            let actionData;
            if (actionType === 'REMOVE_ITEM') {
                actionData = { lineItemId: optionId };
            } else if (actionType === 'SELECT_ACCOUNT') {
                actionData = { itemId: optionId, itemType: optionType };
            } else if (actionType === 'SELECT_OPPORTUNITY') {
                actionData = { itemId: optionId, itemType: optionType, accountId: pendingAccountId };
            } else {
                actionData = { itemId: optionId, itemType: optionType, quantity: quantity };
            }

            const result = await executeAction({
                actionType: actionType,
                actionDataJson: JSON.stringify(actionData),
                quoteId: this.recordId
            });

            this.isTyping = false;

            if (result) {
                this.addAssistantMessage(result);
                if (result.action === 'REFRESH') {
                    this.dispatchEvent(new CustomEvent('refresh'));
                }
                if (result.action === 'NAVIGATE' && result.recordId) {
                    this.dispatchEvent(new CustomEvent('navigate', { detail: { recordId: result.recordId } }));
                }
            }
        } catch (error) {
            this.isTyping = false;
            const errMsg = error.body?.message || error.message || 'Action failed.';
            this.addAssistantMessage({ responseType: 'text', message: '⚠️ ' + errMsg, success: false });
        }

        this.scrollToBottom();
    }

    // ═══════════════════════════════════════════════
    //  MESSAGE RENDERING
    // ═══════════════════════════════════════════════

    addUserMessage(text) {
        this.messageIdCounter++;
        this.messages = [...this.messages, {
            id: 'msg-' + this.messageIdCounter,
            rawText: text,
            text: this.escapeHtml(text),
            isUser: true,
            isAssistant: false,
            responseType: 'text',
            isTextType: true,
            timestamp: this.formatTime(new Date()),
            bubbleClass: 'message user-message'
        }];
    }

    addAssistantMessage(result) {
        this.messageIdCounter++;
        const responseType = result.responseType || 'text';
        const success = result.success !== false;

        let bubbleClass = 'message assistant-message';
        if (!success) bubbleClass += ' msg-error';
        if (responseType === 'action_result') bubbleClass += ' msg-success';

        const msgObj = {
            id: 'msg-' + this.messageIdCounter,
            rawText: result.message || '',
            text: this.formatMarkdown(result.message || ''),
            isUser: false,
            isAssistant: true,
            responseType: responseType,
            timestamp: this.formatTime(new Date()),
            bubbleClass: bubbleClass,
            // Disambiguation data
            hasOptions: responseType === 'disambiguation' && result.options?.length > 0,
            options: result.options || [],
            pendingAction: result.pendingAction || '',
            pendingQuantity: result.pendingQuantity || 1,
            pendingAccountId: result.pendingAccountId || '',
            // Summary/Insight data
            data: result.data || null,
            hasSummaryData: responseType === 'summary' && result.data != null,
            hasInsightData: responseType === 'insight' && result.data != null,
            // Type checks for template
            isTextType: responseType === 'text' || responseType === 'action_result',
            isDisambiguationType: responseType === 'disambiguation',
            isSummaryType: responseType === 'summary',
            isInsightType: responseType === 'insight',
            isActionResult: responseType === 'action_result'
        };

        this.messages = [...this.messages, msgObj];
    }

    // ═══════════════════════════════════════════════
    //  FORMATTING
    // ═══════════════════════════════════════════════

    formatMarkdown(text) {
        if (!text) return '';
        let html = this.escapeHtml(text);
        // Bold **text**
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic _text_
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        // Newlines
        html = html.replace(/\\n/g, '<br>');
        html = html.replace(/\n/g, '<br>');
        // Bullet points
        html = html.replace(/• /g, '<span class="bullet">•</span> ');
        return html;
    }

    escapeHtml(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
        return text.replace(/[&<>]/g, (m) => map[m] || m);
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    formatCurrency(val) {
        if (val == null) return '$0.00';
        return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    scrollToBottom() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const chatBody = this.template.querySelector('.chat-body');
            if (chatBody) {
                chatBody.scrollTop = chatBody.scrollHeight;
            }
        }, 100);
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}
