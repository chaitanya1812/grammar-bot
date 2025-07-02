// Smart Text Assistant - handles text selection popup for explain, summarize, and custom actions
class SmartTextAssistant {
    constructor() {
        this.selectionPopup = null;
        this._currentSelection = null;
        this.isProcessing = false;
        this.lastClickTime = 0;
        this.popupCreationTime = 0; // Track when popup was created
        this.menuRestorationTime = 0; // Track when menu was restored
        this.showingResult = false; // Track if we're showing a result/content
        
        this.init();
    }
    
    // Add getter/setter for currentSelection to track when it changes
    get currentSelection() {
        return this._currentSelection;
    }
    
    set currentSelection(value) {
        this._currentSelection = value;
    }

    init() {
        console.log('Smart Text Assistant: Initializing...');
        this.setupSelectionListeners();
    }

    setupSelectionListeners() {
        // Listen for text selection with higher priority (capture phase)
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e), true);
        document.addEventListener('touchend', (e) => this.handleTextSelection(e), true);
        
        // Listen for clicks to hide popup (use click instead of mousedown to avoid conflicts)
        document.addEventListener('click', (e) => this.handleGlobalClick(e), true);
        
        // Listen for escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectionPopup) {
                this.hideSelectionPopup();
            }
        });
    }

    handleTextSelection(e) {
        // Prevent showing popup too frequently
        const now = Date.now();
        if (now - this.lastClickTime < 100) return;
        this.lastClickTime = now;

        // Small delay to ensure selection is complete
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText && selectedText.length > 3 && selectedText.length < 10000) {
                // CRITICAL: Don't create new popup if one already exists
                if (this.selectionPopup) {
                    console.log('🧠 Ignoring - popup already exists, not creating new one');
                    return;
                }

                // Don't show if clicking on grammar assistant elements
                if (e.target.closest('.gb-popup') || 
                    e.target.closest('.grammar-floating-btn') ||
                    e.target.closest('.grammar-suggestion-tooltip')) {
                    console.log('🧠 Ignoring - clicked on grammar assistant element');
                    return;
                }

                console.log('🧠 Creating new popup for selection');
                this.currentSelection = {
                    text: selectedText,
                    range: selection.getRangeAt(0).cloneRange()
                };

                this.showSelectionPopup(e);
            } else {
                // Only hide popup if we're not processing, not showing results, and no text is selected
                if (!this.isProcessing && !this.showingResult) {
                    console.log('🧠 No valid text selected, hiding popup');
                    this.hideSelectionPopup();
                } else {
                    if (this.isProcessing) {
                        console.log('🧠 No valid text selected but processing, keeping popup');
                    } else if (this.showingResult) {
                        console.log('🧠 No valid text selected but showing result, keeping popup');
                    }
                }
            }
        }, 50);
    }

    handleGlobalClick(e) {
        // No popup exists, nothing to do
        if (!this.selectionPopup) {
            return;
        }

        // Don't close popup immediately after creation or menu restoration
        const now = Date.now();
        if (now - this.popupCreationTime < 150) {
            console.log('🧠 Global click ignored - popup too new:', now - this.popupCreationTime, 'ms');
            return;
        }
        if (now - this.menuRestorationTime < 200) {
            console.log('🧠 Global click ignored - menu just restored:', now - this.menuRestorationTime, 'ms');
            return;
        }

        // Check if click is inside popup or any of its child elements
        const isInsidePopup = this.selectionPopup.contains(e.target) || 
                             e.target.closest('.gb-selection-popup');

        if (!isInsidePopup) {
            console.log('🧠 Clicked outside popup, checking if text selected...');
            // Don't hide if user is selecting text
            const selection = window.getSelection();
            if (!selection.toString().trim()) {
                console.log('🧠 No text selected, attempting to hide popup');
                this.hideSelectionPopup(); // Will respect processing state
            } else {
                console.log('🧠 Text selected, keeping popup open');
            }
        } else {
            console.log('🧠 Clicked inside popup, keeping open');
        }
    }

    showSelectionPopup(mouseEvent) {
        // Only hide existing popup, but preserve currentSelection for the new popup
        if (this.selectionPopup) {
            this.selectionPopup.classList.remove('gb-visible');
            setTimeout(() => {
                if (this.selectionPopup) {
                    this.selectionPopup.remove();
                    this.selectionPopup = null;
                }
            }, 200);
        }
        this.isProcessing = false; // Reset processing state

        const popup = this.createSelectionPopup();
        document.body.appendChild(popup);
        this.selectionPopup = popup;
        
        // Track when popup was created to prevent immediate closing
        this.popupCreationTime = Date.now();
        this.showingResult = false; // Initialize as showing main menu

        // Position popup near the mouse cursor
        this.positionPopup(popup, mouseEvent);

        // Show popup with animation
        setTimeout(() => {
            popup.classList.add('gb-visible');
        }, 10);
    }

    createSelectionPopup() {
        // Safety check to ensure currentSelection exists
        if (!this.currentSelection) {
            console.error('❌ Smart Text Assistant: No text selected');
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = '<p>Error: No text selected</p>';
            return errorDiv;
        }
        
        if (!this.currentSelection.text) {
            console.error('❌ Smart Text Assistant: No text in selection');
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = '<p>Error: No text in selection</p>';
            return errorDiv;
        }
        
        const popup = document.createElement('div');
        popup.className = 'gb-selection-popup';
        
        // Prevent any clicks inside the popup from bubbling up
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        const selectedText = this.currentSelection.text;
        const truncatedText = selectedText.length > 100 
            ? selectedText.substring(0, 100) + '...'
            : selectedText;

        popup.innerHTML = `
            <div class="gb-selection-popup-header">
                <button class="gb-selection-popup-back" style="display: none;">←</button>
                <div class="gb-selection-popup-title">
                    🧠 Smart Text Assistant
                </div>
                <button class="gb-selection-popup-close">×</button>
            </div>
            <div class="gb-selection-popup-content">
                <div class="gb-selected-preview">"${this.escapeHtml(truncatedText)}"</div>
                <div class="gb-text-actions">
                    <button class="gb-action-btn" data-action="explain">
                        <span class="gb-action-icon">💡</span>
                        <div class="gb-action-text">
                            <div class="gb-action-title">Explain</div>
                            <div class="gb-action-desc">Understand difficult words & concepts</div>
                        </div>
                    </button>
                    <button class="gb-action-btn" data-action="summarize">
                        <span class="gb-action-icon">📋</span>
                        <div class="gb-action-text">
                            <div class="gb-action-title">Summarize</div>
                            <div class="gb-action-desc">Get a concise summary (~10% length)</div>
                        </div>
                    </button>
                    <button class="gb-action-btn" data-action="custom">
                        <span class="gb-action-icon">✏️</span>
                        <div class="gb-action-text">
                            <div class="gb-action-title">Custom Prompt</div>
                            <div class="gb-action-desc">Ask anything about this text</div>
                        </div>
                    </button>
                </div>
            </div>
        `;

        // Store original content for back navigation
        this.originalPopupContent = popup.querySelector('.gb-selection-popup-content').innerHTML;

        // ENSURE back button is hidden on main menu (force hide)
        const backBtn = popup.querySelector('.gb-selection-popup-back');
        backBtn.style.display = 'none';
        backBtn.style.visibility = 'hidden'; // Double protection

        // Add event listeners
        popup.querySelector('.gb-selection-popup-close').addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('🧠 Close button clicked - force hiding popup');
            this.hideSelectionPopup(true, true); // clearSelection=true, force=true
        });

        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMainMenu(popup);
        });

        popup.querySelectorAll('.gb-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                e.preventDefault(); // Prevent default behavior
                console.log('🧠 Action button clicked:', btn.dataset.action);
                const action = btn.dataset.action;
                this.handleAction(action, popup);
            });
            
            // Also prevent mouseup events from triggering text selection
            btn.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                console.log('🧠 Button mouseup stopped');
            });
        });

        return popup;
    }

    showMainMenu(popup) {
        console.log('🧠 showMainMenu called');
        
        // Set protection flags to prevent immediate closing
        this.popupCreationTime = Date.now(); // Reset timing protection
        this.menuRestorationTime = Date.now(); // Track menu restoration
        
        // Restore original content
        const content = popup.querySelector('.gb-selection-popup-content');
        content.innerHTML = this.originalPopupContent;
        
        // Hide back button, show main title
        const backBtn = popup.querySelector('.gb-selection-popup-back');
        const title = popup.querySelector('.gb-selection-popup-title');
        backBtn.style.display = 'none';
        backBtn.style.visibility = 'hidden'; // Double protection against any CSS overrides
        title.textContent = '🧠 Smart Text Assistant';
        
        // Prevent clicks on main menu content from bubbling up
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Re-attach event listeners to action buttons
        popup.querySelectorAll('.gb-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                e.preventDefault(); // Prevent default behavior
                console.log('🧠 Action button clicked (main menu):', btn.dataset.action);
                const action = btn.dataset.action;
                this.handleAction(action, popup);
            });
            
            // Also prevent mouseup events from triggering text selection
            btn.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                console.log('🧠 Button mouseup stopped (main menu)');
            });
        });
        
        // Reset processing state and result display flag
        this.isProcessing = false;
        this.showingResult = false; // Back to main menu, not showing results
        
        console.log('🧠 showMainMenu completed, popup should stay open');
    }

    positionPopup(popup, mouseEvent) {
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Use clientX/clientY for viewport-relative coordinates instead of pageX/pageY
        let x = mouseEvent.clientX;
        let y = mouseEvent.clientY;

        // Adjust horizontal position to keep popup in viewport
        if (x + popupRect.width > viewportWidth) {
            x = viewportWidth - popupRect.width - 20;
        }
        
        // Adjust vertical position to keep popup in viewport
        if (y + popupRect.height > viewportHeight) {
            y = y - popupRect.height - 20; // Position above the cursor
        }
        
        // If positioning above would go off-screen, position at top of viewport
        if (y < 0) {
            y = 10;
        }

        // Ensure minimum margins from edges
        x = Math.max(10, Math.min(x, viewportWidth - popupRect.width - 10));
        y = Math.max(10, Math.min(y, viewportHeight - popupRect.height - 10));

        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
    }

    async handleAction(action, popup) {
        if (this.isProcessing) return;
        
        if (action === 'custom') {
            this.showCustomPromptInput(popup);
            return;
        }

        this.isProcessing = true;
        this.showLoadingState(popup, action);

        try {
            const result = await this.callTextInsightsAPI(action);
            this.showResult(popup, action, result);
        } catch (error) {
            this.showError(popup, error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    showCustomPromptInput(popup) {
        const content = popup.querySelector('.gb-selection-popup-content');
        const backBtn = popup.querySelector('.gb-selection-popup-back');
        const title = popup.querySelector('.gb-selection-popup-title');
        
        // Update header for custom prompt mode
        backBtn.style.display = 'block';
        backBtn.style.visibility = 'visible';
        title.textContent = '✏️ Custom Prompt';
        
        const truncatedText = this.currentSelection.text.length > 100 
            ? this.currentSelection.text.substring(0, 100) + '...'
            : this.currentSelection.text;

        // Replace content with custom prompt interface
        content.innerHTML = `
            <div class="gb-selected-preview">"${this.escapeHtml(truncatedText)}"</div>
            <div class="gb-custom-prompt-section">
                <textarea class="gb-custom-input" placeholder="Ask anything about this text...

Examples:
• Translate this to Spanish
• What are the main points?
• Explain this in simple terms
• Find any errors or inconsistencies
• Create a bullet-point summary"></textarea>
                <button class="gb-action-btn" id="gb-submit-custom" style="margin-top: 8px;">
                    <span class="gb-action-icon">🚀</span>
                    <div class="gb-action-text">
                        <div class="gb-action-title">Submit Request</div>
                        <div class="gb-action-desc">Press Ctrl+Enter to submit</div>
                    </div>
                </button>
            </div>
        `;

        const textarea = popup.querySelector('.gb-custom-input');
        const submitBtn = popup.querySelector('#gb-submit-custom');
        
        // Focus on textarea
        setTimeout(() => textarea.focus(), 100);

        // Enhanced submit button handler
        submitBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent event bubbling
            e.preventDefault(); // Prevent default behavior
            console.log('🧠 Custom prompt submit clicked');
            
            const customPrompt = textarea.value.trim();
            if (!customPrompt) {
                // Highlight the textarea if empty
                textarea.style.borderColor = '#ff6b6b';
                textarea.focus();
                setTimeout(() => {
                    textarea.style.borderColor = '';
                }, 2000);
                return;
            }

            // Disable button during processing
            submitBtn.disabled = true;
            this.isProcessing = true;

            try {
                this.showLoadingState(popup, 'custom');
                const result = await this.callTextInsightsAPI('custom', customPrompt);
                this.showResult(popup, 'custom', result, customPrompt);
            } catch (error) {
                this.showError(popup, error.message);
            } finally {
                this.isProcessing = false;
                submitBtn.disabled = false;
            }
        });

        // Prevent mouseup from triggering text selection
        submitBtn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            console.log('🧠 Custom submit button mouseup stopped');
        });

        // Enhanced keyboard handling
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                submitBtn.click();
            }
            // Auto-resize textarea as user types
            if (e.target.scrollHeight > e.target.clientHeight) {
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }
        });

        // Input event for real-time validation
        textarea.addEventListener('input', (e) => {
            const hasContent = e.target.value.trim().length > 0;
            submitBtn.disabled = !hasContent;
            submitBtn.style.opacity = hasContent ? '1' : '0.6';
            
            // Reset border color when user starts typing
            if (e.target.style.borderColor === 'rgb(255, 107, 107)') {
                e.target.style.borderColor = '';
            }
        });

        // Initially disable submit button
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';

        // Prevent clicks on custom prompt content from bubbling up
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Mark that we're showing content (not main menu)
        this.showingResult = true;

        // Re-attach back button event listener (lost when innerHTML was replaced)
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('🧠 Back button clicked from custom prompt view');
            this.showMainMenu(popup);
        });
    }

    showLoadingState(popup, action) {
        const content = popup.querySelector('.gb-selection-popup-content');
        const backBtn = popup.querySelector('.gb-selection-popup-back');
        const title = popup.querySelector('.gb-selection-popup-title');
        
        // Show back button and update title
        backBtn.style.display = 'block';
        backBtn.style.visibility = 'visible';
        
        const actionNames = {
            'explain': 'Explaining',
            'summarize': 'Summarizing', 
            'custom': 'Processing'
        };
        
        const actionTitles = {
            'explain': '💡 Explaining Text',
            'summarize': '📋 Summarizing Text',
            'custom': '✏️ Processing Request'
        };

        title.textContent = actionTitles[action];

        const truncatedText = this.currentSelection.text.length > 100 
            ? this.currentSelection.text.substring(0, 100) + '...'
            : this.currentSelection.text;

        content.innerHTML = `
            <div class="gb-selected-preview">"${this.escapeHtml(truncatedText)}"</div>
            <div class="gb-loading-section">
                <div class="gb-dots-loading">
                    <div class="gb-dot"></div>
                    <div class="gb-dot"></div>
                    <div class="gb-dot"></div>
                </div>
                <span>${actionNames[action]} text...</span>
            </div>
        `;

        // Prevent clicks on loading content from bubbling up
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Mark that we're showing content (not main menu)
        this.showingResult = true;
    }

    showResult(popup, action, result, customPrompt = null) {
        const content = popup.querySelector('.gb-selection-popup-content');
        const backBtn = popup.querySelector('.gb-selection-popup-back');
        const title = popup.querySelector('.gb-selection-popup-title');
        
        // Show back button and update title
        backBtn.style.display = 'block';
        backBtn.style.visibility = 'visible';
        
        const actionNames = {
            'explain': 'Explanation',
            'summarize': 'Summary',
            'custom': 'Result'
        };

        const actionIcons = {
            'explain': '💡',
            'summarize': '📋',
            'custom': '✏️'
        };
        
        const actionTitles = {
            'explain': '💡 Explanation Result',
            'summarize': '📋 Summary Result',
            'custom': '✏️ Custom Result'
        };

        title.textContent = actionTitles[action];

        const truncatedText = this.currentSelection.text.length > 100 
            ? this.currentSelection.text.substring(0, 100) + '...'
            : this.currentSelection.text;

        let customPromptSection = '';
        if (customPrompt) {
            customPromptSection = `
                <div style="margin-bottom: 12px; padding: 8px; background: #e8f4ff; border-radius: 6px; font-size: 12px; color: #0066cc;">
                    <strong>Your question:</strong> ${this.escapeHtml(customPrompt)}
                </div>
            `;
        }

        content.innerHTML = `
            <div class="gb-selected-preview">"${this.escapeHtml(truncatedText)}"</div>
            ${customPromptSection}
            <div class="gb-result-section">
                <div class="gb-result-header">
                    <span>${actionIcons[action]}</span>
                    <span>${actionNames[action]}</span>
                </div>
                <div class="gb-result-content">${this.formatResult(result)}</div>
            </div>
        `;

        // Prevent clicks on result content from bubbling up
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Mark that we're showing content (not main menu)
        this.showingResult = true;

        // Re-attach back button event listener (lost when innerHTML was replaced)
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('🧠 Back button clicked from result view');
            this.showMainMenu(popup);
        });
    }

    showError(popup, errorMessage) {
        const content = popup.querySelector('.gb-selection-popup-content');
        const backBtn = popup.querySelector('.gb-selection-popup-back');
        const title = popup.querySelector('.gb-selection-popup-title');
        
        // Show back button and update title
        backBtn.style.display = 'block';
        backBtn.style.visibility = 'visible';
        title.textContent = '⚠️ Error Occurred';
        
        const truncatedText = this.currentSelection.text.length > 100 
            ? this.currentSelection.text.substring(0, 100) + '...'
            : this.currentSelection.text;

        content.innerHTML = `
            <div class="gb-selected-preview">"${this.escapeHtml(truncatedText)}"</div>
            <div class="gb-error" style="margin-top: 12px;">
                <span class="gb-error-icon">⚠️</span>
                <div>
                    <div>Something went wrong</div>
                    <div class="gb-error-details">${this.escapeHtml(errorMessage)}</div>
                </div>
            </div>
        `;

        // Prevent clicks on error content from bubbling up
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Mark that we're showing content (not main menu)
        this.showingResult = true;

        // Re-attach back button event listener (lost when innerHTML was replaced)
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('🧠 Back button clicked from error view');
            this.showMainMenu(popup);
        });
    }

    async callTextInsightsAPI(action, customPrompt = null) {
        const payload = {
            text: this.currentSelection.text,
            action: action
        };

        if (customPrompt) {
            payload.custom_prompt = customPrompt;
        }

        const response = await fetch('http://localhost:8000/text-insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.result;
    }

    hideSelectionPopup(clearSelection = true, force = false) {
        // Don't hide popup during processing unless forced (e.g., by close button)
        if (this.isProcessing && !force) {
            console.log('🧠 Not hiding popup - processing in progress');
            return;
        }
        
        // Don't hide popup immediately after menu restoration unless forced
        const now = Date.now();
        if (!force && now - this.menuRestorationTime < 200) {
            console.log('🧠 Not hiding popup - menu just restored:', now - this.menuRestorationTime, 'ms');
            return;
        }
        
        console.log('🧠 Hiding popup, clearSelection:', clearSelection, 'force:', force);
        if (this.selectionPopup) {
            this.selectionPopup.classList.remove('gb-visible');
            setTimeout(() => {
                if (this.selectionPopup) {
                    this.selectionPopup.remove();
                    this.selectionPopup = null;
                }
            }, 200);
        }
        if (clearSelection) {
            this.currentSelection = null;
        }
        this.isProcessing = false;
        this.showingResult = false; // Reset result display flag
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatResult(result) {
        // Convert newlines to <br> tags for better display
        return result.replace(/\n/g, '<br>');
    }
}

// Initialize the Smart Text Assistant when DOM is ready
console.log('🧠 Smart Text Assistant: Script loaded, checking DOM state...');
console.log('🧠 Document ready state:', document.readyState);

function initSmartTextAssistant() {
    console.log('🧠 Smart Text Assistant: Initializing...');
    try {
        window.smartTextAssistant = new SmartTextAssistant();
        console.log('🧠 Smart Text Assistant: Successfully created instance:', window.smartTextAssistant);
        
        // Test if the instance is working
        setTimeout(() => {
            console.log('🧠 Smart Text Assistant: Testing if instance is accessible...');
            if (window.smartTextAssistant) {
                console.log('✅ Smart Text Assistant: Instance is accessible!');
                console.log('✅ Selection popup:', window.smartTextAssistant.selectionPopup);
                console.log('✅ Current selection:', window.smartTextAssistant.currentSelection);
            } else {
                console.error('❌ Smart Text Assistant: Instance not accessible!');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Smart Text Assistant: Failed to initialize:', error);
    }
}

if (document.readyState === 'loading') {
    console.log('🧠 Smart Text Assistant: DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🧠 Smart Text Assistant: DOMContentLoaded event fired');
        initSmartTextAssistant();
    });
} else {
    console.log('🧠 Smart Text Assistant: DOM already loaded, initializing immediately');
    initSmartTextAssistant();
}

// Add a global test function for debugging
window.testSmartTextAssistant = function() {
    console.log('🧠 Testing Smart Text Assistant...');
    console.log('Instance exists:', !!window.smartTextAssistant);
    if (window.smartTextAssistant) {
        console.log('Selection popup:', window.smartTextAssistant.selectionPopup);
        console.log('Current selection:', window.smartTextAssistant.currentSelection);
        console.log('Is processing:', window.smartTextAssistant.isProcessing);
    }
    
    // Test if event listeners are working
    console.log('Testing selection...');
    const testSelection = window.getSelection();
    console.log('Current selection:', testSelection.toString());
    
    return window.smartTextAssistant;
}; 