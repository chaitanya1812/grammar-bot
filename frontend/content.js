// Grammar Bot Content Script - Grammarly-like Implementation
class GrammarAssistant {
    constructor() {
        this.currentElement = null;
        this.floatingButton = null;
        this.suggestionPanel = null;
        this.isAnalyzing = false;
        this.isApplyingSuggestion = false;  // Flag to prevent triggering analysis during suggestion application
        this.suggestions = new Map(); // elementId -> suggestions
        this.debounceTimer = null;
        this.reanalysisTimer = null;  // Timer for delayed re-analysis after suggestions applied
        this.isPanelVisible = false;
        this.userManuallyClosed = false;  // Track if user manually closed panel
        
        // Configuration
        this.config = {
            debounceDelay: 2000, // Wait 2s after typing stops (increased to reduce immediate calls)
            minTextLength: 10,
            buttonOffset: { x: 10, y: 10 },
            enabledElements: [
                'textarea', 
                'input[type="text"]', 
                // 'input[type="email"]', 
                // 'input[type="search"]',
                // 'input[type="password"]',
                '[contenteditable="true"]', 
                '[contenteditable=""]',
                '[contenteditable]',
                '.docs-textelement-paragraph',  // Google Docs
                '.notranslate',  // Google Docs text areas
                '.kix-paragraphrenderer'  // Google Docs paragraphs
            ]
        };
        
        this.init();
    }

    async init() {
        console.log('Grammar Assistant: Initializing Grammarly-like system...');
        
        // Load user settings
        await this.loadSettings();
        
        // Set up global styles
        this.injectStyles();
        
        // Set up event listeners
        this.setupGlobalListeners();
        
        // Monitor for text inputs
        this.startElementMonitoring();
        
        console.log('Grammar Assistant: Initialized successfully');
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['autoCheck', 'showToasts'], (result) => {
                this.settings = {
                    autoCheck: result.autoCheck !== false,
                    showToasts: result.showToasts !== false
                };
                resolve();
            });
        });
    }

    injectStyles() {
        if (document.getElementById('grammar-assistant-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'grammar-assistant-styles';
        style.textContent = `
            /* Grammar Assistant Floating Button */
            .grammar-floating-btn {
                position: absolute;
                width: 28px;
                height: 28px;
                background: #1DB584;
                border: 2px solid #ffffff;
                border-radius: 50%;
                cursor: pointer;
                z-index: 2147483647;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                color: white;
                font-weight: bold;
                transition: all 0.2s ease;
                opacity: 0;
                transform: scale(0.8);
            }
            
            .grammar-floating-btn.visible {
                opacity: 1;
                transform: scale(1);
            }
            
            .grammar-floating-btn:hover {
                background: #16A085;
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            
            .grammar-floating-btn.analyzing {
                background: #F39C12;
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            /* Grammarly-style Highlights */
            .grammar-highlight {
                position: relative;
                border-bottom: 2px solid #FFD700;
                cursor: pointer;
                transition: all 0.2s ease;
                background: transparent;
            }
            
            .grammar-highlight:hover {
                background: rgba(255, 215, 0, 0.1);
                border-bottom-color: #FFA500;
            }
            
            /* Hover suggestion tooltip - matching main popup style */
            .grammar-suggestion-tooltip {
                position: absolute;
                background: white;
                color: #333;
                padding: 12px;
                border-radius: 8px;
                font-size: 14px;
                line-height: 1.4;
                z-index: 2147483647;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                max-width: 280px;
                opacity: 0;
                transform: translateY(-5px);
                transition: all 0.2s ease;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .grammar-suggestion-tooltip.visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            
            .grammar-suggestion-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 8px solid transparent;
                border-top-color: white;
            }
            
            .tooltip-suggestion {
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .tooltip-original {
                color: #E74C3C;
                font-weight: 500;
                /* Removed line-through - just color is enough */
            }
            
            .tooltip-arrow {
                color: #666;
                margin: 0 8px;
                font-weight: bold;
            }
            
            .tooltip-corrected {
                color: #27AE60;
                font-weight: 500;
            }
            
            .tooltip-explanation {
                color: #666;
                font-size: 13px;
                margin-bottom: 10px;
                line-height: 1.4;
            }
            
            .tooltip-apply {
                background: linear-gradient(135deg, #27AE60, #229954);
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-block;
                transition: all 0.2s ease;
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .tooltip-apply:hover {
                background: linear-gradient(135deg, #229954, #1E8449);
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            /* Suggestion Panel */
            .grammar-suggestion-panel {
                position: absolute;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                padding: 0;
                max-width: 320px;
                max-height: 300px;
                overflow: hidden;
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.4;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.2s ease;
                pointer-events: none;
                display: flex;
                flex-direction: column;
            }
            
            /* Panel content area that scrolls */
            .panel-content {
                overflow-y: auto;
                padding: 0 12px 12px 12px;
                flex: 1;
                /* Custom scrollbar styling */
                scrollbar-width: thin;
                scrollbar-color: #ccc #f5f5f5;
            }
            
            .panel-content::-webkit-scrollbar {
                width: 6px;
            }
            
            .panel-content::-webkit-scrollbar-track {
                background: #f5f5f5;
                border-radius: 3px;
            }
            
            .panel-content::-webkit-scrollbar-thumb {
                background: #ccc;
                border-radius: 3px;
            }
            
            .panel-content::-webkit-scrollbar-thumb:hover {
                background: #999;
            }
            
            .grammar-suggestion-panel.visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            
            .suggestion-header {
                font-weight: 600;
                color: #333;
                margin-bottom: 12px;
                font-size: 13px;
                background: white;
                padding: 12px;
                margin: 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #f0f0f0;
                border-radius: 8px 8px 0 0;
            }
            
            .suggestion-close-btn {
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 16px;
                padding: 2px 4px;
                border-radius: 3px;
                transition: all 0.2s ease;
                line-height: 1;
                margin-left: 8px;
                flex-shrink: 0;
            }
            
            .suggestion-close-btn:hover {
                background: #f0f0f0;
                color: #666;
            }
            
            .suggestion-item {
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 8px;
                border: 1px solid #e0e0e0;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                z-index: 1;
            }
            
            .suggestion-item:hover {
                background: #f5f5f5;
                border-color: #1DB584;
            }
            
            .suggestion-text {
                font-weight: 500;
                color: #1DB584;
                margin-bottom: 4px;
            }
            
            .suggestion-reason {
                font-size: 12px;
                color: #666;
            }
            
            /* Input Field Indicators */
            .grammar-monitored {
                position: relative;
            }
            
            .grammar-status-indicator {
                position: absolute;
                bottom: 4px;
                right: 4px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #1DB584;
                z-index: 10;
                opacity: 0.7;
            }
            
            .grammar-status-indicator.analyzing {
                background: #F39C12;
                animation: pulse 1s infinite;
            }
            
            .grammar-status-indicator.has-suggestions {
                background: #E74C3C;
            }
        `;
        
        document.head.appendChild(style);
    }

    setupGlobalListeners() {
        // Listen for focus on text inputs
        document.addEventListener('focusin', (e) => this.handleElementFocus(e), true);
        document.addEventListener('focusout', (e) => this.handleElementBlur(e), true);
        
        // Listen for clicks to hide panels (use capture to catch clicks before they're stopped)
        document.addEventListener('click', (e) => this.handleGlobalClick(e), true);
        
        // Listen for scroll to update button position
        document.addEventListener('scroll', () => this.updateButtonPosition(), true);
        
        // Listen for resize
        window.addEventListener('resize', () => this.updateButtonPosition());
        
        // Listen for settings changes
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateSettings') {
                this.settings = { ...this.settings, ...request.settings };
            }
        });
    }

    startElementMonitoring() {
        // Find all existing text inputs
        this.scanForTextInputs();
        
        // Set up mutation observer for new elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.scanForTextInputs(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanForTextInputs(container = document) {
        const selector = this.config.enabledElements.join(', ');
        const elements = container.querySelectorAll ? container.querySelectorAll(selector) : [];
        
        elements.forEach(element => this.setupElementMonitoring(element));
        
        // Also check if container itself is a text input
        if (container.matches && container.matches(selector)) {
            this.setupElementMonitoring(container);
        }
    }

    setupElementMonitoring(element) {
        if (element.grammarAssistantSetup) return;
        
        element.grammarAssistantSetup = true;
        element.classList.add('grammar-monitored');
        
        // Skip status indicator for now to avoid issues
        
        // Set up text change monitoring
        let lastContent = this.getElementText(element);
        
        const checkForChanges = () => {
            const currentContent = this.getElementText(element);
            if (currentContent !== lastContent) {
                console.log('Grammar Assistant: Text change detected', {
                    oldLength: lastContent.length,
                    newLength: currentContent.length,
                    isApplyingSuggestion: this.isApplyingSuggestion,
                    minTextLength: this.config.minTextLength
                });
                
                // Don't clear suggestions if we're currently applying a suggestion
                if (!this.isApplyingSuggestion) {
                    // Clear highlights when content changes
                    this.clearHighlights(element);
                    
                    // Clear stored suggestions for this element
                    const elementId = this.getElementId(element);
                    this.suggestions.delete(elementId);
                }
                
                lastContent = currentContent;
                
                if (currentContent.length >= this.config.minTextLength) {
                    console.log('Grammar Assistant: Text length sufficient, queuing analysis');
                    this.queueTextAnalysis(element, currentContent);
                } else {
                    console.log('Grammar Assistant: Text too short for analysis');
                    if (!this.isApplyingSuggestion) {
                        this.updateElementIndicator(element, 'clean');
                        this.updateButtonState('complete', 0);
                    }
                }
            } else {
                console.log('Grammar Assistant: No text change detected');
            }
        };
        
        // Listen for various text change events
        element.addEventListener('input', checkForChanges);
        element.addEventListener('paste', () => setTimeout(checkForChanges, 100));
        element.addEventListener('keyup', checkForChanges);
        
        console.log('Grammar Assistant: Set up monitoring for element', element.tagName);
    }

    handleElementFocus(e) {
        const element = e.target;
        if (!this.isTextInput(element)) return;
        
        this.currentElement = element;
        this.showFloatingButton(element);
        
        // Load existing suggestions for this element
        this.loadElementSuggestions(element);
        
        console.log('Grammar Assistant: Text input focused', element.tagName);
    }

    handleElementBlur(e) {
        // Don't hide immediately - user might click the button
        setTimeout(() => {
            if (!this.isInteractingWithAssistant() && !this.isApplyingSuggestion) {
                this.hideFloatingButton();
            }
        }, 150);
    }

    isTextInput(element) {
        return this.config.enabledElements.some(selector => {
            try {
                return element.matches(selector);
            } catch (e) {
                return false;
            }
        });
    }

    getElementText(element) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            return element.value;
        } else if (element.contentEditable === 'true') {
            return element.textContent || element.innerText || '';
        }
        return '';
    }

    setElementText(element, text) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            element.value = text;
        } else if (element.contentEditable === 'true') {
            // For contenteditable, preserve HTML formatting by only replacing text content
            this.preserveFormattingTextReplace(element, text);
        }
        
        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    preserveFormattingTextReplace(element, newText) {
        // Get the current plain text content
        const currentText = element.textContent || element.innerText || '';
        
        console.log('Grammar Assistant: preserveFormattingTextReplace called');
        console.log('Grammar Assistant: currentText:', JSON.stringify(currentText));
        console.log('Grammar Assistant: newText:', JSON.stringify(newText));
        console.log('Grammar Assistant: element HTML before:', element.innerHTML);
        
        // If the text is the same, no need to replace
        if (currentText === newText) {
            console.log('Grammar Assistant: Text is the same, no replacement needed');
            return;
        }
        
        // Try to use a more sophisticated approach: find and replace specific text changes
        // while preserving the DOM structure
        if (this.smartTextReplace(element, currentText, newText)) {
            console.log('Grammar Assistant: Smart text replace succeeded');
            console.log('Grammar Assistant: element HTML after:', element.innerHTML);
            return;
        }
        
        // Fallback: if we can't do selective replacement, use textContent
        // This will lose formatting but at least the text will be correct
        console.warn('Grammar Assistant: Could not preserve formatting, falling back to textContent replacement');
        element.textContent = newText;
    }

    smartTextReplace(element, currentText, newText) {
        // Find what changed between the old and new text
        const changes = this.findTextChanges(currentText, newText);
        
        if (changes.length === 0) {
            return false;
        }
        
        console.log('Grammar Assistant: Found changes:', changes);
        
        // For each change, try to find it in the DOM and replace it
        for (const change of changes) {
            if (!this.applyChangeToDOM(element, change)) {
                console.warn('Grammar Assistant: Could not apply change to DOM:', change);
                return false;
            }
        }
        
        return true;
    }

    applyChangeToDOM(element, change) {
        // Walk through all text nodes and find the one containing our change
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let currentPos = 0;
        let node;
        
        while (node = walker.nextNode()) {
            const nodeText = node.textContent;
            const nodeStart = currentPos;
            const nodeEnd = currentPos + nodeText.length;
            
            // Check if this change starts within this text node
            if (change.start >= nodeStart && change.start < nodeEnd) {
                const relativeStart = change.start - nodeStart;
                const relativeEnd = Math.min(change.end - nodeStart, nodeText.length);
                
                // Check if the text we're looking for actually matches
                const textToReplace = nodeText.substring(relativeStart, relativeEnd);
                
                if (textToReplace === change.oldText) {
                    // Replace the text within this node
                    const beforeText = nodeText.substring(0, relativeStart);
                    const afterText = nodeText.substring(relativeEnd);
                    const newNodeText = beforeText + change.newText + afterText;
                    
                    console.log('Grammar Assistant: Replacing in text node:', {
                        oldNodeText: nodeText,
                        newNodeText: newNodeText,
                        textToReplace: textToReplace,
                        replacement: change.newText
                    });
                    
                    node.textContent = newNodeText;
                    return true;
            } else {
                    console.warn('Grammar Assistant: Text mismatch in node:', {
                        expected: change.oldText,
                        found: textToReplace,
                        nodeText: nodeText
                    });
                }
            }
            
            currentPos = nodeEnd;
        }
        
        return false;
    }

    findTextChanges(oldText, newText) {
        // Simple approach: find the first difference and create a replacement
        // This works well for single word/phrase corrections
        
        let startDiff = 0;
        let endDiff = 0;
        
        // Find where the texts start to differ
        while (startDiff < oldText.length && startDiff < newText.length && 
               oldText[startDiff] === newText[startDiff]) {
            startDiff++;
        }
        
        // Find where the texts end differently (working backwards)
        while (endDiff < (oldText.length - startDiff) && 
               endDiff < (newText.length - startDiff) &&
               oldText[oldText.length - 1 - endDiff] === newText[newText.length - 1 - endDiff]) {
            endDiff++;
        }
        
        // If no differences found, return empty changes
        if (startDiff === oldText.length && newText.length === oldText.length) {
            return [];
        }
        
        // Extract the changed portion
        const oldPortion = oldText.substring(startDiff, oldText.length - endDiff);
        const newPortion = newText.substring(startDiff, newText.length - endDiff);
        
        return [{
            start: startDiff,
            end: oldText.length - endDiff,
            oldText: oldPortion,
            newText: newPortion
        }];
    }

    showFloatingButton(element) {
        if (!this.floatingButton) {
            this.createFloatingButton();
        }
        
        // Check for existing suggestions for this element and update button state accordingly
        const elementId = this.getElementId(element);
        const existingSuggestions = this.suggestions.get(elementId);
        
        // Preserve visible state before updating
        const wasVisible = this.floatingButton.classList.contains('visible');
        console.log('Grammar Assistant: showFloatingButton - wasVisible:', wasVisible, 'className before:', this.floatingButton.className);
        
        if (existingSuggestions && existingSuggestions.length > 0) {
            // Update button to show count
            this.updateButtonState('complete', existingSuggestions.length);
        } else {
            // Only set default text if no suggestions exist
            this.floatingButton.textContent = '✓';
            this.floatingButton.style.backgroundColor = '#4CAF50';  // Green for no issues
        }
        
        // Always preserve existing classes - never reset className completely
        console.log('Grammar Assistant: Ensuring base class is present without removing other classes');
        if (!this.floatingButton.classList.contains('grammar-floating-btn')) {
            this.floatingButton.classList.add('grammar-floating-btn');
        }
        
        console.log('Grammar Assistant: showFloatingButton - className after updates:', this.floatingButton.className);
        this.positionFloatingButton(element);
        
        // Show with animation only if not already visible
        if (!wasVisible) {
            setTimeout(() => {
                this.floatingButton.classList.add('visible');
            }, 10);
        }
    }

    createFloatingButton() {
        this.floatingButton = document.createElement('div');
        this.floatingButton.className = 'grammar-floating-btn';
        this.floatingButton.textContent = '✓';
        this.floatingButton.title = 'Grammar Assistant';
        
        this.floatingButton.addEventListener('click', (e) => {
                e.stopPropagation();
            this.handleButtonClick();
        });
        
        // Debug: Monitor when button loses visibility
        const buttonObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const hasVisible = this.floatingButton.classList.contains('visible');
                    if (!hasVisible && this.currentElement) {
                        console.warn('Grammar Assistant: Button lost visible class!', {
                            currentElement: !!this.currentElement,
                            isApplyingSuggestion: this.isApplyingSuggestion,
                            className: this.floatingButton.className,
                            stackTrace: new Error().stack
                        });
                        // Force it back to visible if we have a current element
                        if (this.currentElement) {
                            setTimeout(() => {
                                if (this.floatingButton && this.currentElement) {
                                    this.floatingButton.classList.add('visible');
                                    console.log('Grammar Assistant: Forced button back to visible');
                                }
                            }, 10);
                        }
                    }
                }
            });
        });
        
        buttonObserver.observe(this.floatingButton, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        document.body.appendChild(this.floatingButton);
    }

    positionFloatingButton(element) {
        if (!element || !this.floatingButton) return;
        
        const rect = element.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Position at bottom-right of the input
        const left = rect.right - 38 + scrollX;
        const top = rect.bottom - 38 + scrollY;
        
        this.floatingButton.style.left = `${left}px`;
        this.floatingButton.style.top = `${top}px`;
    }

    updateButtonPosition() {
        if (this.currentElement && this.floatingButton && this.floatingButton.classList.contains('visible')) {
            this.positionFloatingButton(this.currentElement);
        }
    }

    hideFloatingButton() {
        // Don't hide button if we're currently applying a suggestion
        if (this.isApplyingSuggestion) {
            console.log('Grammar Assistant: Skipping hide button - currently applying suggestion');
            return;
        }
        
        // Don't hide if we're analyzing or have suggestions showing
        if (this.currentElement && (this.isAnalyzing || this.isPanelVisible)) {
            console.log('Grammar Assistant: Skipping hide button - currently analyzing or panel visible');
            return;
        }
        
        // Don't hide if there's still a focused text input (element switching)
        const activeElement = document.activeElement;
        if (activeElement && this.isTextInput(activeElement)) {
            console.log('Grammar Assistant: Skipping hide button - another text input is focused');
            return;
        }
        
        // Don't hide if user is still interacting with our components
        if (this.isInteractingWithAssistant()) {
            console.log('Grammar Assistant: Skipping hide button - user interacting with assistant');
            return;
        }
        
        console.log('Grammar Assistant: Hiding button - all conditions met');
        if (this.floatingButton) {
            this.floatingButton.classList.remove('visible');
        }
        this.hideSuggestionPanel();
    }

    handleButtonClick() {
        console.log('Grammar Assistant: Button clicked!');
        
        if (!this.currentElement) {
            console.log('Grammar Assistant: No current element');
            return;
        }
        
        // Toggle panel visibility
        if (this.isPanelVisible) {
            console.log('Grammar Assistant: Toggling panel - hiding');
            this.hideSuggestionPanel();
            this.userManuallyClosed = true;  // User manually closed
            return;
        }
        
        const text = this.getElementText(this.currentElement);
        console.log('Grammar Assistant: Current text:', text);
        
        if (text.length < this.config.minTextLength) {
            this.showToast('Please enter more text to analyze', 'info');
            return;
        }
        
        // Check if we have existing suggestions
        const elementId = this.getElementId(this.currentElement);
        const existingSuggestions = this.suggestions.get(elementId);
        
        console.log('Grammar Assistant: Existing suggestions:', existingSuggestions);
        
        if (existingSuggestions && existingSuggestions.length > 0) {
            console.log('Grammar Assistant: Showing existing suggestions panel');
            this.showSuggestionPanel(this.currentElement, existingSuggestions);
            this.userManuallyClosed = false;  // Reset since user manually opened
            } else {
            console.log('Grammar Assistant: No existing suggestions, analyzing text');
            this.userManuallyClosed = false;  // Reset for new analysis
            this.analyzeText(this.currentElement, text, true); // true = allow auto-show panel for manual analysis
        }
    }

    queueTextAnalysis(element, text) {
        console.log('Grammar Assistant: queueTextAnalysis called', {
            autoCheck: this.settings.autoCheck,
            isApplyingSuggestion: this.isApplyingSuggestion,
            textLength: text.length,
            debounceDelay: this.config.debounceDelay
        });
        
        if (!this.settings.autoCheck) {
            console.log('Grammar Assistant: Auto-check is disabled, skipping analysis');
            return;
        }
        
        // Don't queue analysis if we're currently applying a suggestion
        if (this.isApplyingSuggestion) {
            console.log('Grammar Assistant: Skipping text analysis - currently applying suggestion');
            return;
        }
        
        // Clear existing timer
        if (this.debounceTimer) {
            console.log('Grammar Assistant: Clearing existing debounce timer');
            clearTimeout(this.debounceTimer);
        }
        
        // Set new timer
        console.log('Grammar Assistant: Setting new debounce timer for', this.config.debounceDelay, 'ms');
        this.debounceTimer = setTimeout(() => {
            console.log('Grammar Assistant: Debounce timer fired, starting analysis');
            this.analyzeText(element, text, false); // false = don't auto-show panel
        }, this.config.debounceDelay);
    }

    queueDelayedReanalysis(element, delay = 3000) {
        // Clear existing reanalysis timer
        if (this.reanalysisTimer) {
            clearTimeout(this.reanalysisTimer);
        }
        
        // Set new timer for delayed re-analysis
        this.reanalysisTimer = setTimeout(() =>  {
            const currentText = this.getElementText(element);
            if (currentText && currentText.length >= this.config.minTextLength) {
                console.log(`Grammar Assistant: Running delayed re-analysis (${delay}ms delay)`);
                this.analyzeText(element, currentText, false); // Don't auto-show panel for verification
            }
        }, delay);
        
        console.log(`Grammar Assistant: Queued delayed re-analysis (${delay}ms delay)`);
    }

    async analyzeText(element, text, allowAutoShowPanel = false) {
        if (this.isAnalyzing) return;
        
        this.isAnalyzing = true;
        this.updateButtonState('analyzing');
        this.updateElementIndicator(element, 'analyzing');
        
        try {
            console.log('Grammar Assistant: Analyzing text...', text.substring(0, 50));
            
            // Split into sentences
            const sentences = this.splitIntoSentences(text);
            console.log('Grammar Assistant: Split into', sentences.length, 'sentences');
            
            // Analyze with backend
            const response = await chrome.runtime.sendMessage({
                action: 'checkGrammar',
                data: { text, feature: 'grammar_check' }
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            // Process suggestions
            console.log('Grammar Assistant: Raw suggestions from backend:', response.suggestions);
            const suggestions = this.processSuggestions(response.suggestions || []);
            console.log('Grammar Assistant: Processed suggestions:', suggestions);
            
            // Store suggestions FIRST, before showing panel
            const elementId = this.getElementId(element);
            console.log('Grammar Assistant: Storing suggestions for element:', elementId, 'Count:', suggestions.length);
            console.log('Grammar Assistant: Suggestions being stored:', suggestions.map(s => ({ id: s.id, original: s.original, suggestion: s.suggestion })));
            this.suggestions.set(elementId, suggestions);
            
            // Apply highlights
            if (suggestions.length > 0) {
                console.log('Grammar Assistant: About to apply highlights for', suggestions.length, 'suggestions');
                this.applyHighlights(element, suggestions);
                console.log('Grammar Assistant: Finished applying highlights');
            } else {
                console.log('Grammar Assistant: No suggestions to highlight');
            }
            
            // Update UI
            this.updateButtonState('complete', suggestions.length);
            this.updateElementIndicator(element, suggestions.length > 0 ? 'has-suggestions' : 'clean');
            
            // Show panel if allowed and there are suggestions
            if (suggestions.length > 0 && allowAutoShowPanel && !this.userManuallyClosed) {
                this.showSuggestionPanel(element, suggestions);
            }
            
            console.log('Grammar Assistant: Analysis complete, found', suggestions.length, 'suggestions');
            
        } catch (error) {
            console.error('Grammar Assistant: Analysis failed:', error);
            this.showToast('Analysis failed. Please try again.', 'error');
            this.updateButtonState('error');
            this.updateElementIndicator(element, 'error');
        } finally {
            this.isAnalyzing = false;
        }
    }

    splitIntoSentences(text) {
        // Simple sentence splitting - can be enhanced
        return text.match(/[^\.!?]+[\.!?]+/g) || [text];
    }

    processSuggestions(rawSuggestions) {
        if (!Array.isArray(rawSuggestions)) {
            console.warn('Grammar Assistant: rawSuggestions is not an array:', rawSuggestions);
            return [];
        }
        
        return rawSuggestions.map((suggestion, index) => {
            console.log('Grammar Assistant: Processing suggestion', index, ':', suggestion);
            console.log('Grammar Assistant: Available fields:', Object.keys(suggestion));
            
            const explanation = suggestion.explanation || suggestion.message || '';
            let original = suggestion.original_text || suggestion.original || suggestion.text || '';
            let replacementText = suggestion.corrected_text || suggestion.suggestion || suggestion.replacement || suggestion.corrected || '';
            
            console.log('Grammar Assistant: Extracted original:', original, 'replacement:', replacementText);
            
            // If we don't have original/replacement, try to extract from explanation
            if (!original || !replacementText) {
                console.log('Grammar Assistant: Missing original/replacement, extracting from explanation');
                const extracted = this.extractReplacementFromExplanation(explanation);
                console.log('Grammar Assistant: Extraction result:', extracted);
                if (extracted.original) original = extracted.original;
                if (extracted.replacement) replacementText = extracted.replacement;
                console.log('Grammar Assistant: Final original/replacement:', original, '→', replacementText);
            }
            
            const startIndex = suggestion.start || suggestion.startIndex || 0;
            const originalLength = original.length;
            const endIndex = suggestion.end || suggestion.endIndex || (startIndex + originalLength);
            
            const processed = {
                id: `suggestion-${Date.now()}-${index}`,
                type: this.determineSuggestionType(explanation),
                original: original,
                suggestion: replacementText,
                explanation: explanation,
                confidence: suggestion.confidence || 0.8,
                startIndex: startIndex,
                endIndex: endIndex
            };
            
            console.log('Grammar Assistant: Processed suggestion:', processed);
            return processed;
        });
    }

    extractReplacementFromExplanation(explanation) {
        console.log('Grammar Assistant: Extracting from explanation:', explanation);
        
        const result = { original: '', replacement: '' };
        const lowerExplanation = explanation.toLowerCase();
        
        // Extract quoted words
        const quotedWords = explanation.match(/"([^"]+)"/g) || explanation.match(/'([^']+)'/g) || [];
        console.log('Grammar Assistant: Found quoted words:', quotedWords);
        
        // Pattern 1: "The word 'X' should be singular" OR "X is plural but should be singular"
        if (lowerExplanation.includes('should be singular') || 
            (lowerExplanation.includes('is plural') && lowerExplanation.includes('subject is singular'))) {
            if (quotedWords.length > 0) {
                const word = quotedWords[0].replace(/['"]/g, '');
                result.original = word;
                result.replacement = this.makeSingular(word);
            }
        }
        // Pattern 2: "The word 'X' should be plural" OR "X is singular but should be plural"
        else if (lowerExplanation.includes('should be plural') ||
                (lowerExplanation.includes('is singular') && lowerExplanation.includes('subject is plural'))) {
            if (quotedWords.length > 0) {
                const word = quotedWords[0].replace(/['"]/g, '');
                result.original = word;
                result.replacement = this.makePlural(word);
            }
        }
        // Pattern 3: Verb agreement with singular subjects
        else if ((lowerExplanation.includes('verb should agree') || lowerExplanation.includes('subject-verb agreement')) 
                && lowerExplanation.includes('singular')) {
            // Common verb agreement fixes
            if (lowerExplanation.includes("'it'") || lowerExplanation.includes('"it"') ||
                lowerExplanation.includes("'he'") || lowerExplanation.includes('"he"') ||
                lowerExplanation.includes("'she'") || lowerExplanation.includes('"she"')) {
                result.original = 'have';
                result.replacement = 'has';
            }
        }
        // Pattern 4: Verb agreement with plural subjects
        else if ((lowerExplanation.includes('verb should agree') || lowerExplanation.includes('subject-verb agreement'))
                && lowerExplanation.includes('plural')) {
            result.original = 'has';
            result.replacement = 'have';
        }
        // Pattern 5: Look for "should be" patterns
        else if (lowerExplanation.includes('should be')) {
            const match = explanation.match(/'([^']+)'\s+should be\s+'([^']+)'/i) || 
                         explanation.match(/"([^"]+)"\s+should be\s+"([^"]+)"/i);
            if (match) {
                result.original = match[1];
                result.replacement = match[2];
            }
        }
        // Pattern 6: Generic fallback - if we have quoted words, make educated guesses
        else if (quotedWords.length > 0) {
            const word = quotedWords[0].replace(/['"]/g, '');
            result.original = word;
            
            // Make smart guesses based on context
            if (lowerExplanation.includes('plural') && lowerExplanation.includes('singular')) {
                // Word is plural but should be singular
                result.replacement = this.makeSingular(word);
            } else if (lowerExplanation.includes('singular') && lowerExplanation.includes('plural')) {
                // Word is singular but should be plural
                result.replacement = this.makePlural(word);
            } else if (lowerExplanation.includes('agreement') || lowerExplanation.includes('agree')) {
                // Verb agreement issue
                if (word === 'have') result.replacement = 'has';
                else if (word === 'has') result.replacement = 'have';
                else if (word === 'are') result.replacement = 'is';
                else if (word === 'is') result.replacement = 'are';
            }
        }
        
        console.log('Grammar Assistant: Extracted replacement:', result);
        return result;
    }

    makeSingular(word) {
        // Simple singularization rules
        if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
        if (word.endsWith('es')) return word.slice(0, -2);
        if (word.endsWith('s')) return word.slice(0, -1);
        return word;
    }

    makePlural(word) {
        // Simple pluralization rules
        if (word.endsWith('y')) return word.slice(0, -1) + 'ies';
        if (word.endsWith('s') || word.endsWith('x') || word.endsWith('z') || 
            word.endsWith('ch') || word.endsWith('sh')) return word + 'es';
        return word + 's';
    }

    determineSuggestionType(explanation) {
        if (explanation.toLowerCase().includes('grammar')) return 'grammar';
        if (explanation.toLowerCase().includes('style')) return 'style';
        if (explanation.toLowerCase().includes('clarity')) return 'clarity';
        return 'grammar';
    }

    applyHighlights(element, suggestions) {
        console.log('Grammar Assistant: Applying Grammarly-style highlights for', suggestions.length, 'suggestions');
        console.log('Grammar Assistant: Element type:', element.tagName, 'contentEditable:', element.contentEditable);
        console.log('Grammar Assistant: Suggestions to highlight:', suggestions.map(s => s.original));
        
        // Clear any existing highlights first
        this.clearHighlights(element);
        
        if (!suggestions || suggestions.length === 0) {
            console.log('Grammar Assistant: No suggestions to highlight');
            return;
        }
        
        // For contenteditable elements, we can highlight the text directly
        if (element.contentEditable === 'true' || element.hasAttribute('contenteditable')) {
            let elementHTML = element.innerHTML;
            console.log('Grammar Assistant: Original element HTML:', elementHTML);
            
            // Apply highlights for each suggestion
            suggestions.forEach((suggestion, index) => {
                if (suggestion.original && suggestion.original.trim()) {
                    const originalText = suggestion.original.trim();
                    console.log('Grammar Assistant: Attempting to highlight:', originalText);
                    // Use more flexible regex that doesn't rely on word boundaries for better matching
                    const regex = new RegExp(this.escapeRegex(originalText), 'gi');
                    
                    // Create highlighted span with data attributes
                    const replacement = `<span class="grammar-highlight" data-suggestion-id="${suggestion.id}" data-original="${originalText}" data-suggestion="${suggestion.suggestion}" data-explanation="${suggestion.explanation}">${originalText}</span>`;
                    
                    const beforeReplace = elementHTML;
                    elementHTML = elementHTML.replace(regex, replacement);
                    
                    if (beforeReplace !== elementHTML) {
                        console.log('Grammar Assistant: Successfully applied highlight for:', originalText);
                    } else {
                        console.warn('Grammar Assistant: Failed to find text to highlight:', originalText);
                    }
                }
            });
            
            // Only update if we made changes
            if (elementHTML !== element.innerHTML) {
                element.innerHTML = elementHTML;
                console.log('Grammar Assistant: Updated element HTML with highlights');
                console.log('Grammar Assistant: New element HTML:', element.innerHTML);
                
                // Add hover handlers to highlighted text
                const highlights = element.querySelectorAll('.grammar-highlight');
                console.log('Grammar Assistant: Found', highlights.length, 'highlight elements after update');
                highlights.forEach(highlight => {
                    this.setupHighlightHover(highlight, element);
                });
                
                // Debug: Check if highlights are still there after a short delay
                setTimeout(() => {
                    const stillThere = element.querySelectorAll('.grammar-highlight');
                    console.log('Grammar Assistant: After 100ms delay, found', stillThere.length, 'highlights still in DOM');
                    if (stillThere.length === 0) {
                        console.warn('Grammar Assistant: Highlights were removed shortly after application!');
                    } else {
                        // Check if highlights are visible
                        const firstHighlight = stillThere[0];
                        const computedStyle = window.getComputedStyle(firstHighlight);
                        console.log('Grammar Assistant: First highlight CSS:', {
                            display: computedStyle.display,
                            visibility: computedStyle.visibility,
                            opacity: computedStyle.opacity,
                            borderBottom: computedStyle.borderBottom,
                            position: computedStyle.position
                        });
                    }
                }, 100);
            } else {
                console.warn('Grammar Assistant: No changes made to element HTML - highlights not applied');
            }
        } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            // For input/textarea, create overlay highlights
            console.log('Grammar Assistant: Applying overlay highlights for input/textarea');
            this.createOverlayHighlights(element, suggestions);
        }
    }

    setupHighlightHover(highlight, element) {
        let tooltip = null;
        let hoverTimeout = null;

        const showTooltip = () => {
            // Clear any existing timeout
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }

            // Get suggestion data
            const suggestionId = highlight.getAttribute('data-suggestion-id');
            const original = highlight.getAttribute('data-original');
            const suggestion = highlight.getAttribute('data-suggestion');
            const explanation = highlight.getAttribute('data-explanation');

            // Create tooltip
            tooltip = document.createElement('div');
            tooltip.className = 'grammar-suggestion-tooltip';
            
            tooltip.innerHTML = `
                <div class="tooltip-suggestion">
                    <span class="tooltip-original">${original}</span>
                    <span class="tooltip-arrow">→</span>
                    <span class="tooltip-corrected">${suggestion}</span>
                </div>
                <div class="tooltip-explanation">${explanation}</div>
                <button class="tooltip-apply" data-suggestion-id="${suggestionId}">Apply suggestion</button>
            `;

            document.body.appendChild(tooltip);

            // Position tooltip above the highlight
            const rect = highlight.getBoundingClientRect();
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

            // Force layout to get accurate tooltip dimensions
            tooltip.style.visibility = 'hidden';
            tooltip.style.display = 'block';
            const tooltipRect = tooltip.getBoundingClientRect();
            tooltip.style.visibility = '';
            tooltip.style.display = '';

            // Calculate center position of the highlight
            const highlightCenterX = rect.left + (rect.width / 2) + scrollX;
            const highlightTop = rect.top + scrollY;
            const highlightBottom = rect.bottom + scrollY;

            // Position tooltip centered above the highlight
            let left = highlightCenterX - (tooltipRect.width / 2);
            let top = highlightTop - tooltipRect.height - 10; // 10px gap above highlight
            let showBelow = false;

            // Adjust horizontal position if tooltip would go off screen
            const margin = 10;
            if (left < margin) {
                left = margin;
            } else if (left + tooltipRect.width > window.innerWidth - margin) {
                left = window.innerWidth - tooltipRect.width - margin;
            }

            // If not enough space above, show below
            if (top < margin) {
                top = highlightBottom + 10; // 10px gap below highlight
                showBelow = true;
                tooltip.style.setProperty('--arrow-position', 'top');
            }

            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;

            // Add tooltip hover handlers to keep it visible when hovering over it
            tooltip.addEventListener('mouseenter', () => {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
            });

            tooltip.addEventListener('mouseleave', () => {
                hideTooltip();
            });

            // Add tooltip hover handlers to keep it visible when hovering over it
            tooltip.addEventListener('mouseenter', () => {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
            });

            tooltip.addEventListener('mouseleave', () => {
                hideTooltip();
            });

            // Show with animation
            setTimeout(() => {
                if (tooltip) {
                    tooltip.classList.add('visible');
                }
            }, 10);

            // Add click handler to apply button
            const applyBtn = tooltip.querySelector('.tooltip-apply');
            applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Find the suggestion and apply it
                const elementId = this.getElementId(element);
                const suggestions = this.suggestions.get(elementId) || [];
                const suggestionObj = suggestions.find(s => s.id === suggestionId);
                
                if (suggestionObj) {
                    console.log('Grammar Assistant: Applying suggestion from tooltip:', suggestionObj);
                    
                    // Hide tooltip immediately
                    hideTooltip();
                    
                    // Apply the suggestion
                    this.applySuggestion(element, suggestionObj, suggestionId);
                }
            });
        };

        const hideTooltip = () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            if (tooltip) {
                tooltip.classList.remove('visible');
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                    tooltip = null;
                }, 200);
            }
        };

        // Store reference to hideTooltip for global access
        this.hideTooltip = hideTooltip;

        // Mouse enter - show tooltip after short delay
        highlight.addEventListener('mouseenter', () => {
            hoverTimeout = setTimeout(showTooltip, 300); // 300ms delay like Grammarly
        });

        // Mouse leave - hide tooltip
        highlight.addEventListener('mouseleave', () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            
            // Hide tooltip after a short delay to allow moving to tooltip
            setTimeout(() => {
                if (tooltip && !tooltip.matches(':hover') && !highlight.matches(':hover')) {
                    hideTooltip();
                }
            }, 100);
        });

        // Note: Tooltip hover handlers will be added after tooltip is created and positioned
    }

    clearHighlights(element) {
        console.log('Grammar Assistant: clearHighlights called');
        console.log('Grammar Assistant: Stack trace:', new Error().stack);
        
        // Set flag to prevent button hiding during DOM manipulation
        const wasAppplying = this.isApplyingSuggestion;
        this.isApplyingSuggestion = true;
        
        // Hide any visible tooltips
        if (this.hideTooltip) {
            this.hideTooltip();
        }
        
        // Remove any leftover tooltips
        const tooltips = document.querySelectorAll('.grammar-suggestion-tooltip');
        tooltips.forEach(tooltip => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        });
        
        if (element.contentEditable === 'true' || element.hasAttribute('contenteditable')) {
            // Remove all grammar highlight spans
            const highlights = element.querySelectorAll('.grammar-highlight');
            console.log('Grammar Assistant: Removing', highlights.length, 'existing highlights');
            highlights.forEach(highlight => {
                const parent = highlight.parentNode;
                if (parent) {
                    // Replace the highlight span with its text content
                    const textNode = document.createTextNode(highlight.textContent);
                    parent.insertBefore(textNode, highlight);
                    parent.removeChild(highlight);
                }
            });
            
            // Normalize the element to merge adjacent text nodes
            element.normalize();
        } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            // Remove overlay highlights for input/textarea
            this.removeOverlayHighlights(element);
        }
        
        // Restore the flag
        this.isApplyingSuggestion = wasAppplying;
        console.log('Grammar Assistant: clearHighlights completed');
    }

    // Panel hover highlighting methods
    highlightSuggestionInPanel(element, suggestionId) {
        // Find the specific highlight span for this suggestion
        const highlight = element.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (highlight) {
            // Add temporary hover class
            highlight.classList.add('panel-hover');
            highlight.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
            highlight.style.borderBottomColor = '#FF6B35';
            console.log('Grammar Assistant: Highlighted suggestion in panel:', suggestionId);
        }
    }
    
    removeHoverHighlightInPanel(element) {
        // Remove all panel hover highlights
        const hoverHighlights = element.querySelectorAll('.grammar-highlight.panel-hover');
        hoverHighlights.forEach(highlight => {
            highlight.classList.remove('panel-hover');
            highlight.style.backgroundColor = '';
            highlight.style.borderBottomColor = '';
        });
    }
    
    // Legacy methods - now handled by tooltip system
    highlightTextInElement(element, originalText) {
        // This is now handled by the Grammarly-style tooltip system
        console.log('Grammar Assistant: Legacy highlight method called - using tooltip system instead');
    }
    
    removeHighlightFromElement(element) {
        // This is now handled by the Grammarly-style tooltip system
        console.log('Grammar Assistant: Legacy remove highlight method called - using tooltip system instead');
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    createOverlayHighlights(element, suggestions) {
        // Remove any existing overlay highlights
        this.removeOverlayHighlights(element);
        
        if (!suggestions || suggestions.length === 0) return;
        
        const text = this.getElementText(element);
        if (!text) return;
        
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.className = 'grammar-overlay-container';
        overlay.setAttribute('data-element-id', this.getElementId(element));
        
        // Position overlay exactly over the input/textarea
        const rect = element.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        
        overlay.style.cssText = `
            position: absolute;
            left: ${rect.left + scrollX}px;
            top: ${rect.top + scrollY}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            pointer-events: none;
            z-index: 1000;
            padding: ${window.getComputedStyle(element).padding};
            font-family: ${window.getComputedStyle(element).fontFamily};
            font-size: ${window.getComputedStyle(element).fontSize};
            line-height: ${window.getComputedStyle(element).lineHeight};
            border: ${window.getComputedStyle(element).borderWidth} solid transparent;
            box-sizing: border-box;
            overflow: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
        `;
        
        // Create highlighted text
        let highlightedText = text;
        
        // Sort suggestions by position to avoid conflicts
        const sortedSuggestions = [...suggestions].sort((a, b) => {
            const aIndex = text.toLowerCase().indexOf(a.original?.toLowerCase() || '');
            const bIndex = text.toLowerCase().indexOf(b.original?.toLowerCase() || '');
            return bIndex - aIndex; // Reverse order to replace from end to start
        });
        
        sortedSuggestions.forEach((suggestion) => {
            if (suggestion.original && suggestion.original.trim()) {
                const originalText = suggestion.original.trim();
                const regex = new RegExp(this.escapeRegex(originalText), 'gi');
                
                const replacement = `<span class="grammar-overlay-highlight" 
                    data-suggestion-id="${suggestion.id}" 
                    data-original="${originalText}" 
                    data-suggestion="${suggestion.suggestion}" 
                    data-explanation="${suggestion.explanation}"
                    style="background: rgba(255, 215, 0, 0.3); border-bottom: 2px solid #FFD700; cursor: pointer; pointer-events: auto;">${originalText}</span>`;
                
                highlightedText = highlightedText.replace(regex, replacement);
            }
        });
        
        overlay.innerHTML = highlightedText;
        document.body.appendChild(overlay);
        
        // Add hover handlers to overlay highlights
        const overlayHighlights = overlay.querySelectorAll('.grammar-overlay-highlight');
        overlayHighlights.forEach(highlight => {
            this.setupHighlightHover(highlight, element);
        });
        
        // Update overlay position on scroll/resize
        const updateOverlayPosition = () => {
            const newRect = element.getBoundingClientRect();
            const newScrollY = window.pageYOffset || document.documentElement.scrollTop;
            const newScrollX = window.pageXOffset || document.documentElement.scrollLeft;
            
            overlay.style.left = `${newRect.left + newScrollX}px`;
            overlay.style.top = `${newRect.top + newScrollY}px`;
            overlay.style.width = `${newRect.width}px`;
            overlay.style.height = `${newRect.height}px`;
        };
        
        // Store update function for cleanup
        element._overlayUpdateHandler = updateOverlayPosition;
        
        // Listen for scroll and resize events
        window.addEventListener('scroll', updateOverlayPosition, true);
        window.addEventListener('resize', updateOverlayPosition);
        
        console.log('Grammar Assistant: Created overlay highlights for input element');
    }
    
    removeOverlayHighlights(element) {
        const elementId = this.getElementId(element);
        const existingOverlay = document.querySelector(`[data-element-id="${elementId}"]`);
        
        if (existingOverlay) {
            // Remove event listeners
            if (element._overlayUpdateHandler) {
                window.removeEventListener('scroll', element._overlayUpdateHandler, true);
                window.removeEventListener('resize', element._overlayUpdateHandler);
                delete element._overlayUpdateHandler;
            }
            
            existingOverlay.remove();
        }
    }

    updateSuggestionPanelContent(element, suggestions) {
        if (!this.suggestionPanel || !this.isPanelVisible) {
            // If panel doesn't exist or isn't visible, don't try to update it
            console.log('Grammar Assistant: Panel not visible, skipping update');
            return;
        }
        
        console.log('Grammar Assistant: Updating panel content with:', suggestions);
        
        // More lenient filtering - check for explanation OR valid suggestion text
        const validSuggestions = suggestions.filter(s => {
            const hasExplanation = s.explanation && s.explanation.trim();
            const hasSuggestion = s.suggestion && s.suggestion.trim();
            const isValid = hasExplanation || hasSuggestion;
            console.log('Grammar Assistant: Filtering suggestion:', {
                id: s.id,
                original: s.original,
                suggestion: s.suggestion,
                explanation: s.explanation,
                hasExplanation: hasExplanation,
                hasSuggestion: hasSuggestion,
                isValid: isValid
            });
            return isValid;
        });
        
        console.log('Grammar Assistant: Valid suggestions after filtering:', validSuggestions.length, 'out of', suggestions.length);
        
        if (validSuggestions.length === 0) {
            // Show completion message instead of closing immediately
            this.suggestionPanel.innerHTML = `
                <div class="suggestion-header" style="color: #27AE60; text-align: center;">
                    ✓ All suggestions applied!
                </div>
            `;
        setTimeout(() => {
                this.hideSuggestionPanel();
            }, 2000);
            return;
        }
        
        // Clear existing content and rebuild
        this.suggestionPanel.innerHTML = '';
        
        const header = document.createElement('div');
        header.className = 'suggestion-header';
        header.style.cssText = `
            position: relative;
            background: white;
            padding: 12px;
            margin: 0;
            border-bottom: 1px solid #f0f0f0;
            border-radius: 8px 8px 0 0;
            z-index: 10;
        `;
        
        const headerText = document.createElement('span');
        headerText.textContent = `${validSuggestions.length} suggestion${validSuggestions.length !== 1 ? 's' : ''} remaining`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'suggestion-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close suggestions';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideSuggestionPanel();
            this.userManuallyClosed = true;
        });
        
        header.appendChild(headerText);
        header.appendChild(closeBtn);
        
        // Fix header positioning to prevent covering first suggestion
        header.style.cssText = `
            position: relative;
            background: white;
            padding: 12px;
            margin: 0;
            border-bottom: 1px solid #f0f0f0;
            border-radius: 8px 8px 0 0;
            z-index: 10;
            flex-shrink: 0;
        `;
        
        this.suggestionPanel.appendChild(header);
        
        this.addSuggestionItems(element, validSuggestions);
        
        // Removed scroll indicator - users can see the scrollbar
        
        // Ensure panel stays positioned correctly
        this.positionSuggestionPanel(element);
    }

    addSuggestionItems(element, validSuggestions) {
        validSuggestions.slice(0, 5).forEach((suggestion, displayIndex) => {
            console.log('Grammar Assistant: Creating suggestion item for:', suggestion);
            
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            
            const text = document.createElement('div');
            text.className = 'suggestion-text';
            // Show the replacement with original word using color coding (no strikethrough)
            if (suggestion.original && suggestion.suggestion) {
                text.innerHTML = `<span style="color: #E74C3C; font-weight: 500;">${suggestion.original}</span> <span style="color: #666; font-weight: bold; margin: 0 8px;">→</span> <span style="color: #27AE60; font-weight: 500;">${suggestion.suggestion}</span>`;
            } else {
                text.textContent = suggestion.suggestion || 'Apply suggestion';
            }
            
            const reason = document.createElement('div');
            reason.className = 'suggestion-reason';
            reason.textContent = suggestion.explanation;
            
            item.appendChild(text);
            item.appendChild(reason);
            
            // Add hover highlighting for panel suggestions
            item.addEventListener('mouseenter', () => {
                this.highlightSuggestionInPanel(element, suggestion.id);
            });
            
            item.addEventListener('mouseleave', () => {
                this.removeHoverHighlightInPanel(element);
            });
            
            // Find the actual index in the stored suggestions array
            const elementId = this.getElementId(element);
            console.log('Grammar Assistant: addSuggestionItems - Element ID:', elementId);
            console.log('Grammar Assistant: addSuggestionItems - Element type:', element.tagName);
            const allSuggestions = this.suggestions.get(elementId) || [];
            console.log('Grammar Assistant: addSuggestionItems - All stored suggestions for this element:', allSuggestions.length);
            const actualIndex = allSuggestions.findIndex(s => s.id === suggestion.id);
            
            console.log('Grammar Assistant: Looking for suggestion ID:', suggestion.id);
            console.log('Grammar Assistant: All stored suggestions:', allSuggestions.map(s => s.id));
            console.log('Grammar Assistant: Found suggestion at index:', actualIndex);
            
            // Always add click handler - we'll find the index during application
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event from bubbling up to global click handler
                console.log('Grammar Assistant: Suggestion item clicked, suggestion:', suggestion);
                this.applySuggestion(element, suggestion, suggestion.id); // Pass ID instead of index
            });
            
            // Append to content wrapper instead of main panel
            if (this.panelContentWrapper) {
                this.panelContentWrapper.appendChild(item);
            } else {
                this.suggestionPanel.appendChild(item);
            }
        });
    }

    showSuggestionPanel(element, suggestions) {
        console.log('Grammar Assistant: showSuggestionPanel called with:', suggestions);
        this.hideSuggestionPanel();
        
        // More lenient filtering - just check for explanation
        const validSuggestions = suggestions.filter(s => {
            const hasExplanation = s.explanation && s.explanation.trim();
            console.log('Grammar Assistant: Checking suggestion validity:', s, 'Valid:', hasExplanation);
            return hasExplanation;
        });
        
        console.log('Grammar Assistant: Valid suggestions after filtering:', validSuggestions);
        
        if (validSuggestions.length === 0) {
            console.log('Grammar Assistant: No valid suggestions to show');
                return;
            }

        this.suggestionPanel = document.createElement('div');
        this.suggestionPanel.className = 'grammar-suggestion-panel';
        
        // Ensure proper positioning styles are set with flexbox layout
        this.suggestionPanel.style.cssText = `
            position: absolute;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            max-height: 300px;
            overflow: hidden;
        `;
        
        const header = document.createElement('div');
        header.className = 'suggestion-header';
        header.style.cssText = `
            position: relative;
            background: white;
            padding: 12px;
            margin: 0;
            border-bottom: 1px solid #f0f0f0;
            border-radius: 8px 8px 0 0;
            z-index: 10;
        `;
        
        const headerText = document.createElement('span');
        headerText.textContent = `${validSuggestions.length} suggestion${validSuggestions.length !== 1 ? 's' : ''} found`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'suggestion-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close suggestions';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideSuggestionPanel();
            this.userManuallyClosed = true;
        });
        
        header.appendChild(headerText);
        header.appendChild(closeBtn);
        
        // Create content wrapper for scrollable area
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'panel-content';
        contentWrapper.style.cssText = `
            overflow-y: auto;
            padding: 0 12px 12px 12px;
            flex: 1;
            max-height: calc(300px - 60px);
            scrollbar-width: thin;
            scrollbar-color: #ccc #f5f5f5;
        `;
        
        this.suggestionPanel.appendChild(header);
        this.suggestionPanel.appendChild(contentWrapper);
        
        // Store reference to content wrapper for adding items
        this.panelContentWrapper = contentWrapper;
        
        this.addSuggestionItems(element, validSuggestions);
        
        console.log('Grammar Assistant: Adding suggestion panel to DOM');
        console.log('Grammar Assistant: Panel element:', this.suggestionPanel);
        console.log('Grammar Assistant: Panel className:', this.suggestionPanel.className);
        console.log('Grammar Assistant: Panel innerHTML:', this.suggestionPanel.innerHTML);
        
        document.body.appendChild(this.suggestionPanel);
        console.log('Grammar Assistant: Panel added to DOM, positioning...');
        
        this.positionSuggestionPanel(element);
        this.isPanelVisible = true;
        
        console.log('Grammar Assistant: Panel positioned, current styles:', {
            position: this.suggestionPanel.style.position,
            left: this.suggestionPanel.style.left,
            top: this.suggestionPanel.style.top,
            opacity: this.suggestionPanel.style.opacity,
            transform: this.suggestionPanel.style.transform,
            visibility: this.suggestionPanel.style.visibility
        });
        
        // Make panel visible with animation
            setTimeout(() => {
            if (this.suggestionPanel) {
                console.log('Grammar Assistant: Making panel visible');
                this.suggestionPanel.classList.add('visible');
                
                // Removed scroll indicator - users can see the scrollbar
                
                console.log('Grammar Assistant: Panel should now be visible');
            } else {
                console.log('Grammar Assistant: Panel is null when trying to make visible');
                }
            }, 10);
    }

    positionSuggestionPanel(element) {
        if (!element || !this.suggestionPanel) return;
        
        const rect = element.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const margin = 10;
        
        // Calculate space above and below the element
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        // Estimate panel height (use a reasonable default)
        const estimatedPanelHeight = 200; // Default estimate
        
        let left = rect.left + scrollX;
        let top;
        let showAbove = false;
        
        // Simple positioning logic
        if (spaceBelow >= estimatedPanelHeight + margin || spaceBelow >= spaceAbove) {
            // Show below if there's decent space or more space below than above
            top = rect.bottom + margin + scrollY;
            showAbove = false;
            
            // If very limited space below, constrain height
            if (spaceBelow < estimatedPanelHeight + margin) {
                const maxHeight = Math.max(150, spaceBelow - margin * 2);
                this.suggestionPanel.style.maxHeight = `${maxHeight}px`;
            }
        } else {
            // Show above
            showAbove = true;
            
            // If limited space above, constrain height
            if (spaceAbove < estimatedPanelHeight + margin) {
                const maxHeight = Math.max(150, spaceAbove - margin * 2);
                this.suggestionPanel.style.maxHeight = `${maxHeight}px`;
                top = rect.top - maxHeight - margin + scrollY;
            } else {
                top = rect.top - estimatedPanelHeight - margin + scrollY;
            }
        }
        
        // Adjust horizontal position to stay within viewport
        const estimatedPanelWidth = 320; // From CSS max-width
        if (left + estimatedPanelWidth > viewportWidth) {
            left = Math.max(margin, viewportWidth - estimatedPanelWidth - margin);
        }
        
        // Ensure panel doesn't go off the left edge
        if (left < margin) {
            left = margin;
        }
        
        // Apply position
        this.suggestionPanel.style.left = `${left}px`;
        this.suggestionPanel.style.top = `${top}px`;
        
        // Set initial transform for animation
        this.suggestionPanel.style.transform = showAbove ? 'translateY(10px)' : 'translateY(-10px)';
        
        console.log('Grammar Assistant: Panel positioned', {
            showAbove,
            left,
            top,
            elementRect: rect,
            spaceAbove,
            spaceBelow
        });
    }

    hideSuggestionPanel() {
        if (this.suggestionPanel) {
            this.suggestionPanel.remove();
            this.suggestionPanel = null;
        }
        this.isPanelVisible = false;
        
        // Remove any highlighting when panel is hidden
        if (this.currentElement) {
            this.removeHighlightFromElement(this.currentElement);
        }
    }

    applySuggestion(element, suggestion, suggestionId) {
        console.log('Grammar Assistant: Applying suggestion:', suggestion);
        console.log('Grammar Assistant: Suggestion ID to remove:', suggestionId);
        
        // Ensure button stays visible throughout the entire process
        if (this.floatingButton && !this.floatingButton.classList.contains('visible')) {
            this.floatingButton.classList.add('visible');
        }
        
        // Clear any pending text analysis to prevent immediate re-analysis
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        // Also clear any pending re-analysis
        if (this.reanalysisTimer) {
            clearTimeout(this.reanalysisTimer);
            this.reanalysisTimer = null;
        }
        
        // Validate suggestion
        if (!suggestion.suggestion || !suggestion.suggestion.trim()) {
            console.error('Grammar Assistant: Invalid suggestion - empty replacement text');
            this.showToast('Invalid suggestion', 'error');
            return;
        }
        
        const text = this.getElementText(element);
        console.log('Grammar Assistant: Current text:', text);
        
        // Use simple text replacement - LLM should handle punctuation correctly
        let newText = text;
        if (suggestion.original && suggestion.original.trim()) {
            // Use the LLM's suggestion directly
            newText = text.replace(suggestion.original, suggestion.suggestion);
        } else {
            // If no original text, try to find the problematic word from explanation
            const explanation = suggestion.explanation.toLowerCase();
            if (explanation.includes("'") && explanation.includes("'")) {
                // Extract word from explanation like "The verb should agree with the singular subject 'It'."
                const matches = explanation.match(/'([^']+)'/g);
                if (matches && matches.length > 0) {
                    const wordToReplace = matches[0].replace(/'/g, '');
                    newText = text.replace(new RegExp(`\\b${wordToReplace}\\b`, 'i'), suggestion.suggestion);
                }
            } else {
                // Try common grammar fixes if we can't extract from explanation
                if (explanation.includes('verb') && explanation.includes('agree')) {
                    // Common subject-verb agreement fixes
                    if (text.includes('I are')) newText = text.replace('I are', 'I am');
                    else if (text.includes('It have')) newText = text.replace('It have', 'It has');
                    else if (text.includes('He have')) newText = text.replace('He have', 'He has');
                    else if (text.includes('She have')) newText = text.replace('She have', 'She has');
                }
            }
        }
        
        if (newText === text) {
            console.log('Grammar Assistant: Suggestion not applicable - text already changed or not found. Ignoring silently.');
            
            // Remove this outdated suggestion silently
            const elementId = this.getElementId(element);
            const suggestions = this.suggestions.get(elementId) || [];
            const indexToRemove = suggestions.findIndex(s => s.id === suggestionId);
            
            if (indexToRemove >= 0) {
                suggestions.splice(indexToRemove, 1);
                this.suggestions.set(elementId, suggestions);
                
                // Update button and panel
                this.updateButtonState('complete', suggestions.length);
                if (this.isPanelVisible) {
                    this.updateSuggestionPanelContent(element, suggestions);
                }
                
                console.log('Grammar Assistant: Removed outdated suggestion. Remaining:', suggestions.length);
            }
            
            return;
        }
        
        // Apply the new text
        console.log('Grammar Assistant: Replacing text:', text, '→', newText);
        
        // Temporarily disable text monitoring to prevent triggering analysis
        this.isApplyingSuggestion = true;
        
        // Ensure button stays visible before text changes
        if (this.floatingButton) {
            this.floatingButton.classList.add('visible');
        }
        
        // For contenteditable elements, use targeted replacement to preserve formatting
        if (element.contentEditable === 'true') {
            // Instead of replacing the entire text, apply the specific change
            const change = {
                oldText: suggestion.original,
                newText: suggestion.suggestion
            };
            
            if (this.applyTargetedChange(element, change)) {
                console.log('Grammar Assistant: Targeted change applied successfully');
        } else {
                console.log('Grammar Assistant: Targeted change failed - text likely already changed. Ignoring silently.');
                
                // Remove this outdated suggestion silently
                const elementId = this.getElementId(element);
                const suggestions = this.suggestions.get(elementId) || [];
                const indexToRemove = suggestions.findIndex(s => s.id === suggestionId);
                
                if (indexToRemove >= 0) {
                    suggestions.splice(indexToRemove, 1);
                    this.suggestions.set(elementId, suggestions);
                    
                    // Update button and panel
                    this.updateButtonState('complete', suggestions.length);
                    if (this.isPanelVisible) {
                        this.updateSuggestionPanelContent(element, suggestions);
                    }
                    
                    console.log('Grammar Assistant: Removed outdated contenteditable suggestion. Remaining:', suggestions.length);
                }
                
                this.isApplyingSuggestion = false;
                return;
            }
        } else {
            // For input/textarea, use the normal method
            this.setElementText(element, newText);
        }
        
        // Ensure button stays visible after text changes
        if (this.floatingButton) {
            this.floatingButton.classList.add('visible');
        }
        
        this.isApplyingSuggestion = false;
        
        // Remove the applied suggestion by ID
        const elementId = this.getElementId(element);
        console.log('Grammar Assistant: Looking for suggestions for element:', elementId);
        console.log('Grammar Assistant: Element details:', {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            grammarAssistantId: element.grammarAssistantId
        });
        console.log('Grammar Assistant: All stored suggestions in Map:', [...this.suggestions.entries()]);
        const suggestions = this.suggestions.get(elementId) || [];
        console.log('Grammar Assistant: Retrieved suggestions:', suggestions.map(s => ({ id: s.id, original: s.original })));
        console.log('Grammar Assistant: Before removing suggestion - total suggestions:', suggestions.length);
        console.log('Grammar Assistant: Removing suggestion with ID:', suggestionId);
        
        const indexToRemove = suggestions.findIndex(s => s.id === suggestionId);
        console.log('Grammar Assistant: Found suggestion at index:', indexToRemove);
        
        if (indexToRemove >= 0) {
            suggestions.splice(indexToRemove, 1);
            this.suggestions.set(elementId, suggestions);
            console.log('Grammar Assistant: After removing suggestion - remaining suggestions:', suggestions.length);
        } else {
            console.error('Grammar Assistant: Could not find suggestion with ID:', suggestionId, 'Available IDs:', suggestions.map(s => s.id));
        }
        
        // Update button count immediately (before updating highlights to ensure smooth transition)
        this.updateButtonState('complete', suggestions.length);
        
        // Update highlights with remaining suggestions
        this.applyHighlights(element, suggestions);
        
        // Update UI
        this.updateElementIndicator(element, suggestions.length > 0 ? 'has-suggestions' : 'clean');
        
        // Update panel content to show remaining suggestions (if panel is open)
        if (this.isPanelVisible) {
            this.updateSuggestionPanelContent(element, suggestions);
        }
        
        // Toast removed for cleaner UX - user can see the text change directly
        
        // Queue delayed re-analysis to catch any issues with the applied suggestion
        // This acts as a self-correcting mechanism (silent background verification)
        this.queueDelayedReanalysis(element, 5000); // 5 second delay for background verification
        
        // Final safeguard: ensure button is visible at the end of the process
        if (this.floatingButton) {
            this.floatingButton.classList.add('visible');
            console.log('Grammar Assistant: Final visibility check - button should be visible');
        }
        
        // Additional safeguard: ensure button stays visible for at least 500ms after suggestion application
        setTimeout(() => {
            if (this.floatingButton && this.currentElement) {
                this.floatingButton.classList.add('visible');
                console.log('Grammar Assistant: Post-application visibility check - ensuring button remains visible');
            }
        }, 100);
        
        console.log('Grammar Assistant: Applied suggestion successfully. Remaining:', suggestions.length);
    }

    updateButtonState(state, count = 0) {
        if (!this.floatingButton) return;
        
        console.log('Grammar Assistant: updateButtonState called with state:', state, 'count:', count);
        
        // Preserve all existing classes while updating state
        console.log('Grammar Assistant: updateButtonState - className before:', this.floatingButton.className);
        
        // Ensure base class is present without removing other classes
        if (!this.floatingButton.classList.contains('grammar-floating-btn')) {
            this.floatingButton.classList.add('grammar-floating-btn');
        }
        
        console.log('Grammar Assistant: updateButtonState - className after ensuring base class:', this.floatingButton.className);
        
        switch (state) {
            case 'analyzing':
                this.floatingButton.classList.add('analyzing');
                this.floatingButton.textContent = '⏳';
                this.floatingButton.style.backgroundColor = '#FF9800';  // Orange
                break;
            case 'complete':
                this.floatingButton.classList.remove('analyzing'); // Remove analyzing class
                this.floatingButton.textContent = count > 0 ? count.toString() : '✓';
                this.floatingButton.style.backgroundColor = count > 0 ? '#FFD700' : '#4CAF50';  // Yellow for suggestions, green for no issues
                console.log('Grammar Assistant: Button updated - text:', this.floatingButton.textContent, 'color:', this.floatingButton.style.backgroundColor);
                break;
            case 'error':
                this.floatingButton.classList.remove('analyzing'); // Remove analyzing class
                this.floatingButton.textContent = '!';
                this.floatingButton.style.backgroundColor = '#E74C3C';  // Red
                break;
        }
        
        // Ensure button is visible if it should be (safeguard against race conditions)
        if (this.currentElement && !this.floatingButton.classList.contains('visible')) {
            console.log('Grammar Assistant: Button not visible but should be - making it visible');
            this.floatingButton.classList.add('visible');
        }
    }

    updateElementIndicator(element, state) {
        // Skip indicator updates for now to avoid issues
        console.log('Grammar Assistant: Element state:', state);
    }

    getElementId(element) {
        if (!element.grammarAssistantId) {
            element.grammarAssistantId = 'element-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            console.log('Grammar Assistant: Generated new element ID:', element.grammarAssistantId, 'for element:', element.tagName);
        }
        return element.grammarAssistantId;
    }

    loadElementSuggestions(element) {
        const elementId = this.getElementId(element);
        // TODO: Load from chrome.storage.local if needed
    }

    isInteractingWithAssistant() {
        return document.querySelector('.grammar-floating-btn:hover, .grammar-suggestion-panel:hover');
    }

    handleGlobalClick(e) {
        // Hide suggestion panel if clicking outside
        if (this.suggestionPanel && this.isPanelVisible) {
            const target = e.target;
            
            // Check if click is inside the panel or floating button
            const isInsidePanel = this.suggestionPanel.contains(target);
            const isInsideButton = this.floatingButton?.contains(target);
            
            // Check if click is on a grammar highlight (which should not close the panel)
            const isOnHighlight = target.closest('.grammar-highlight');
            
            // Check if click is on a tooltip (which should not close the panel)
            const isOnTooltip = target.closest('.grammar-suggestion-tooltip');
            
            console.log('Grammar Assistant: Global click detected', {
                target: target.tagName,
                targetClass: target.className,
                isInsidePanel,
                isInsideButton,
                isOnHighlight: !!isOnHighlight,
                isOnTooltip: !!isOnTooltip
            });
            
            // Only close if click is truly outside all our components
            if (!isInsidePanel && !isInsideButton && !isOnHighlight && !isOnTooltip) {
                console.log('Grammar Assistant: Closing panel due to outside click');
                this.hideSuggestionPanel();
                this.userManuallyClosed = true;  // User manually closed by clicking outside
            }
        }
    }

    showToast(message, type = 'info') {
        if (!this.settings.showToasts) return;
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#E74C3C' : type === 'success' ? '#27AE60' : '#3498DB'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 2147483647;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    applyTargetedChange(element, change) {
        // Apply a specific text change while preserving HTML structure
        console.log('Grammar Assistant: Applying targeted change:', change);
        
        // Walk through all text nodes and find the one containing our text to replace
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            const nodeText = node.textContent;
            
            // Check if this node contains the text we want to replace
            if (nodeText.includes(change.oldText)) {
                const newNodeText = nodeText.replace(change.oldText, change.newText);
                
                console.log('Grammar Assistant: Targeted replacement in text node:', {
                    oldNodeText: nodeText,
                    newNodeText: newNodeText,
                    oldText: change.oldText,
                    newText: change.newText
                });
                
                node.textContent = newNodeText;
                return true;
            }
        }
        
        console.warn('Grammar Assistant: Could not find text to replace:', change.oldText);
        return false;
    }
}

// Initialize the Grammar Assistant
const grammarAssistant = new GrammarAssistant(); 