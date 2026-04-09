import { LightningElement, api, track, wire } from 'lwc';
import processMessage from '@salesforce/apex/AgentforceController.processMessage';
import getUserContext from '@salesforce/apex/AgentforceController.getUserContext';

export default class CpqAiAssistant extends LightningElement {
    @api recordId;
    @api quoteData;
    @api lineItems = [];

    @track messages = [];
    @track inputValue = '';
    @track isTyping = false;
    @track userContext = {};

    messageIdCounter = 0;

    @wire(getUserContext)
    wiredContext({ data }) {
        if (data) this.userContext = data;
    }

    connectedCallback() {
        // Welcome message
        this.addAssistantMessage(
            '👋 Hi' + (this.userContext.userName ? ' **' + this.userContext.userName + '**' : '') + '! I\'m your CPQ AI Assistant.\n\n' +
            'I can help you manage quotes, add line items, search products, and more.\n\n' +
            'Type **help** to see everything I can do.'
        );
    }

    get contextBadge() {
        if (this.quoteData?.Name) {
            return this.quoteData.Name + ' • ' + (this.quoteData.Status__c || 'Draft');
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
            actions.push({ key: 'summary', label: '📊 Summarize', prompt: 'Summarize this quote' });
            actions.push({ key: 'add', label: '➕ Add Item', prompt: 'Add a ' });
            actions.push({ key: 'recommend', label: '💡 Recommend', prompt: 'What should I add?' });
            if (this.quoteData?.Status__c === 'Draft') {
                actions.push({ key: 'submit', label: '📤 Submit', prompt: 'Submit for approval' });
            }
        } else {
            actions.push({ key: 'create', label: '📝 New Quote', prompt: 'Create a quote for ' });
        }
        actions.push({ key: 'search', label: '🔍 Search', prompt: 'Search ' });
        actions.push({ key: 'help', label: '❓ Help', prompt: 'help' });
        return actions;
    }

    handleQuickAction(event) {
        const prompt = event.currentTarget.dataset.prompt;
        if (prompt === 'Add a ' || prompt === 'Create a quote for ' || prompt === 'Search ') {
            this.inputValue = prompt;
            const input = this.template.querySelector('.chat-input');
            if (input) {
                input.focus();
            }
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

    async handleSend() {
        const msg = this.inputValue.trim();
        if (!msg) return;

        // Add user message
        this.addUserMessage(msg);
        this.inputValue = '';
        this.isTyping = true;
        this.scrollToBottom();

        try {
            const result = await processMessage({
                userMessage: msg,
                quoteId: this.recordId || null
            });

            this.isTyping = false;

            if (result) {
                this.addAssistantMessage(result.message, result.type);

                // Handle actions
                if (result.action === 'REFRESH') {
                    this.dispatchEvent(new CustomEvent('refresh'));
                }
                if (result.action === 'NAVIGATE' && result.recordId) {
                    // Navigate to new quote - for now just refresh
                    this.dispatchEvent(new CustomEvent('refresh'));
                }
            }
        } catch (error) {
            this.isTyping = false;
            const errMsg = error.body?.message || error.message || 'An unexpected error occurred.';
            this.addAssistantMessage('⚠️ ' + errMsg, 'error');
        }

        this.scrollToBottom();
    }

    addUserMessage(text) {
        this.messageIdCounter++;
        this.messages = [...this.messages, {
            id: 'msg-' + this.messageIdCounter,
            text: text,
            isUser: true,
            isAssistant: false,
            timestamp: this.formatTime(new Date()),
            bubbleClass: 'message user-message'
        }];
    }

    addAssistantMessage(text, type) {
        this.messageIdCounter++;
        let bubbleClass = 'message assistant-message';
        if (type === 'error') bubbleClass += ' msg-error';
        if (type === 'success') bubbleClass += ' msg-success';

        this.messages = [...this.messages, {
            id: 'msg-' + this.messageIdCounter,
            text: this.formatMarkdown(text),
            isUser: false,
            isAssistant: true,
            timestamp: this.formatTime(new Date()),
            bubbleClass: bubbleClass
        }];
    }

    formatMarkdown(text) {
        if (!text) return '';
        // Bold **text**
        let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic _text_
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');
        // Newlines
        html = html.replace(/\n/g, '<br>');
        // Bullet points
        html = html.replace(/• /g, '<span class="bullet">•</span> ');
        return html;
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
