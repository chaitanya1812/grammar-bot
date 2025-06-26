// Grammar Bot Content Script
class GrammarBot {
    constructor() {
        this.selectedText = '';
        this.selectionRange = null;
        this.selectedElement = null; // Store reference to the input/textarea element
        this.selectionStart = null; // Store selection start position for input elements
        this.selectionEnd = null; // Store selection end position for input elements
        this.popup = null;
        this.isPopupVisible = false;
        this.features = [];
        this.isCheckingGrammar = false;
        this.currentSuggestions = []; // Store current suggestions
        this.appliedSuggestions = new Set(); // Track applied suggestions
        this.isApplyingFix = false; // Prevent popup hiding during fix application
        this.originalSelectedText = null; // Store original text for sequential fixes
        this.suggestionLengthChanges = new Map(); // Store length changes for each suggestion
        
        this.init();
    }

    async init() {
        // Load features from backend
        await this.loadFeatures();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Grammar Bot initialized successfully');
        console.log('Grammar Bot: Available features:', this.features);
        console.log('Grammar Bot: Extension ready for text selection');
    }

    async loadFeatures() {
        try {
            // Use background script proxy to avoid CORS issues
            const response = await chrome.runtime.sendMessage({
                action: 'loadFeatures'
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            this.features = response.features.filter(f => f.enabled);
        } catch (error) {
            console.error('Failed to load features:', error);
            // Fallback to default features
            this.features = [{
                id: 'grammar_check',
                name: 'Grammar Check',
                description: 'Check for grammar and spelling errors',
                icon: '✓',
                enabled: true
            }];
        }
    }

    setupEventListeners() {
        // Listen for text selection
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
        document.addEventListener('keyup', (e) => this.handleTextSelection(e));
        
        // Hide popup when clicking elsewhere
        document.addEventListener('click', (e) => {
            // Only process if we have a popup and it's not during grammar checking
            if (!this.popup || this.isCheckingGrammar) {
                return;
            }
            
            // Check if click is outside popup
            if (!this.popup.contains(e.target)) {
                // Prevent hiding popup too quickly after creation
                const timeSinceCreation = this.popupCreatedTime ? Date.now() - this.popupCreatedTime : Infinity;
                if (timeSinceCreation < 500) {
                    console.log('Grammar Bot: Ignoring click event - popup just created');
                    return;
                }
                
                console.log('Grammar Bot: Hiding popup due to click outside');
                this.hidePopup();
            }
        });

        // Temporarily disable scroll-based hiding to debug visibility issues
        // TODO: Re-enable with proper debouncing after popup visibility is confirmed
        /*
        document.addEventListener('scroll', () => {
            if (this.isPopupVisible && !this.isCheckingGrammar) {
                console.log('Grammar Bot: Hiding popup due to scroll');
                this.hidePopup();
            }
        });
        */
    }

    handleTextSelection(e) {
        setTimeout(() => {
            // Don't interfere if we're checking grammar
            if (this.isCheckingGrammar) {
                return;
            }

            // Reset selection data
            this.selectedElement = null;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.selectionRange = null;
            this.originalSelectedText = null; // Reset original text for new selection
            this.suggestionLengthChanges.clear(); // Reset length change tracking
            this.appliedSuggestions.clear(); // Reset applied suggestions for new selection

            const activeElement = document.activeElement;
            let selectedText = '';

            // Handle input and textarea elements
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                if (start !== end) {
                    selectedText = activeElement.value.substring(start, end).trim();
                    // Store element and selection positions
                    this.selectedElement = activeElement;
                    this.selectionStart = start;
                    this.selectionEnd = end;
                }
            } else {
                // Handle regular text selections
                const selection = window.getSelection();
                selectedText = selection.toString().trim();
                if (selectedText && selectedText.length > 0) {
                    this.selectionRange = selection.getRangeAt(0);
                }
            }

            if (selectedText && selectedText.length > 3) {
                this.selectedText = selectedText;
                console.log('Grammar Bot: Valid text selection detected:', selectedText.substring(0, 50) + '...');
                // Use a small delay to ensure DOM is stable
                setTimeout(() => {
                    this.showPopup(e);
                }, 50);
            } else if (this.isPopupVisible && !this.isCheckingGrammar && !this.isApplyingFix) {
                // Prevent hiding popup too quickly after creation
                const timeSinceCreation = this.popupCreatedTime ? Date.now() - this.popupCreatedTime : Infinity;
                if (timeSinceCreation < 500) {
                    console.log('Grammar Bot: Ignoring selection change - popup just created');
                    return;
                }
                
                console.log('Grammar Bot: Hiding popup due to no valid text selection');
                this.hidePopup();
            }
        }, 100);
    }

    showPopup(e) {
        // Force cleanup of any existing popups first
        this.forceCleanupPopups();

        const rect = this.getSelectionPosition();
        if (!rect) {
            console.log('Grammar Bot: No selection position found');
            return;
        }

        console.log('Grammar Bot: Selection position:', rect);

        this.popup = this.createPopup();
        this.positionPopup(rect);
        
        // Ensure popup is added to body and not inside any container that might clip it
        document.body.appendChild(this.popup);
        this.isPopupVisible = true;
        this.popupCreatedTime = Date.now();

        console.log('Grammar Bot: Popup positioned at:', {
            top: this.popup.style.top,
            left: this.popup.style.left,
            position: this.popup.style.position
        });

        // Ensure popup is immediately visible
        this.popup.classList.add('gb-popup-visible');
        this.popup.style.setProperty('opacity', '1', 'important');
        this.popup.style.setProperty('transform', 'translateY(0)', 'important');
        
        console.log('Grammar Bot: Popup should now be visible');
        console.log('Grammar Bot: Final popup position:', {
            top: this.popup.style.top,
            left: this.popup.style.left,
            opacity: window.getComputedStyle(this.popup).opacity,
            visibility: window.getComputedStyle(this.popup).visibility,
            display: window.getComputedStyle(this.popup).display,
            zIndex: window.getComputedStyle(this.popup).zIndex
        });
    }

    getSelectionPosition() {
        // Use stored element if available (for input/textarea)
        if (this.selectedElement && (this.selectedElement.tagName === 'INPUT' || this.selectedElement.tagName === 'TEXTAREA')) {
            const rect = this.selectedElement.getBoundingClientRect();
            // For input/textarea, try to get more precise cursor position if possible
            return {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height
            };
        }
        
        // Fallback to active element for input/textarea
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            const rect = activeElement.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height
            };
        }
        
        // Handle regular text selections
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Ensure we have valid dimensions
        if (rect.width === 0 && rect.height === 0) {
            // If the selection has no size, use the range's container element
            const container = range.commonAncestorContainer;
            const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
            if (element) {
                const elementRect = element.getBoundingClientRect();
                return {
                    top: elementRect.top,
                    left: elementRect.left,
                    bottom: elementRect.bottom,
                    right: elementRect.right,
                    width: elementRect.width,
                    height: elementRect.height
                };
            }
        }

        return {
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            width: rect.width,
            height: rect.height
        };
    }

    createPopup() {
        console.log('Grammar Bot: Creating popup with features:', this.features);
        
        const popup = document.createElement('div');
        popup.className = 'gb-popup';
        
        // Add inline styles as fallback to ensure visibility
        popup.style.cssText = `
            position: fixed !important;
            z-index: 2147483647 !important;
            background: #ffffff !important;
            border: 1px solid #e1e5e9 !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
            width: 320px !important;
            max-width: calc(100vw - 20px) !important;
            max-height: 400px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
            color: #333 !important;
            opacity: 1 !important;
            transform: translateY(-10px) !important;
            transition: all 0.2s ease-out !important;
            overflow: hidden !important;
            pointer-events: auto !important;
            isolation: isolate !important;
            display: block !important;
            visibility: visible !important;
        `;
        
        popup.innerHTML = `
            <div class="gb-popup-header">
                <span class="gb-popup-title">Grammar Bot</span>
                <button class="gb-popup-close">×</button>
            </div>
            <div class="gb-popup-content">
                <div class="gb-selected-text">
                    "${this.selectedText.length > 100 ? this.selectedText.substring(0, 100) + '...' : this.selectedText}"
                </div>
                <div class="gb-features">
                    ${this.features.map(feature => `
                        <button class="gb-feature-btn" data-feature="${feature.id}">
                            <span class="gb-feature-icon">${feature.icon}</span>
                            <span class="gb-feature-name">${feature.name}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="gb-loading" style="display: none;">
                    <div class="gb-spinner"></div>
                    <span>Checking grammar...</span>
                </div>
                <div class="gb-suggestions" style="display: none;"></div>
            </div>
        `;

        // Add event listeners to feature buttons
        popup.querySelectorAll('.gb-feature-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Grammar Bot: Feature button clicked');
                const feature = e.currentTarget.dataset.feature;
                this.checkGrammar(feature);
            });
        });

        // Add event listener to close button
        const closeBtn = popup.querySelector('.gb-popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Grammar Bot: Close button clicked');
                this.hidePopup();
            });
        }

        console.log('Grammar Bot: Popup created successfully, element:', popup);
        console.log('Grammar Bot: Popup HTML:', popup.outerHTML.substring(0, 500));
        
        return popup;
    }

    positionPopup(rect) {
        const popup = this.popup;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Since we're using position: fixed, we work with viewport coordinates
        const popupWidth = 320;
        const popupHeight = 400; // max-height
        const padding = 10; // Distance from selection
        const margin = 10; // Margin from viewport edge

        // Calculate initial position (below the selection)
        let top = rect.bottom + padding;
        let left = rect.left;

        // Adjust horizontal position if popup would go off-screen
        if (left + popupWidth > viewportWidth - margin) {
            // Try positioning to the left of the selection
            left = rect.right - popupWidth;
            
            // If still off-screen, position at the right edge of viewport
            if (left < margin) {
                left = viewportWidth - popupWidth - margin;
            }
        }
        
        // Ensure minimum left margin
        if (left < margin) {
            left = margin;
        }

        // Adjust vertical position if popup would go off-screen
        if (top + popupHeight > viewportHeight - margin) {
            // Position above the selection
            top = rect.top - popupHeight - padding;
            
            // If still off-screen, position at the bottom of viewport
            if (top < margin) {
                top = viewportHeight - popupHeight - margin;
            }
        }
        
        // Ensure minimum top margin
        if (top < margin) {
            top = margin;
        }

        // Apply position with !important to override any website styles
        popup.style.setProperty('top', `${top}px`, 'important');
        popup.style.setProperty('left', `${left}px`, 'important');
        popup.style.setProperty('position', 'fixed', 'important');
        
        // Add fallback positioning to center if positioning fails
        if (top < 0 || top > viewportHeight || left < 0 || left > viewportWidth) {
            console.warn('Grammar Bot: Position out of bounds, using fallback center position');
            popup.style.setProperty('top', '50px', 'important');
            popup.style.setProperty('left', '50px', 'important');
        }
    }

    async checkGrammar(feature = 'grammar_check') {
        // Add null check at the start
        if (!this.popup) {
            console.error('Grammar check failed: popup is null');
            return;
        }

        const loadingEl = this.popup.querySelector('.gb-loading');
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        const featuresEl = this.popup.querySelector('.gb-features');

        // Additional null checks
        if (!loadingEl || !suggestionsEl || !featuresEl) {
            console.error('Grammar check failed: popup elements not found');
            return;
        }

        // Reset applied suggestions for new check
        this.appliedSuggestions.clear();
        this.originalSelectedText = null; // Reset for new text selection
        
        // Prevent popup from being hidden during API call
        this.isCheckingGrammar = true;
        console.log('Started grammar check, popup protection enabled');

        // Show loading state
        featuresEl.style.display = 'none';
        suggestionsEl.style.display = 'none';
        loadingEl.style.display = 'flex';

        try {
            console.log('Making request to backend via background script with text:', this.selectedText);
            
            // Use background script proxy to avoid CORS issues
            const data = await chrome.runtime.sendMessage({
                action: 'checkGrammar',
                data: {
                    text: this.selectedText,
                    feature: feature
                }
            });

            console.log('Response received from background script:', data);

            if (data.error) {
                throw new Error(data.error);
            }

            console.log('Data parsed successfully:', data);
            
            // Check if popup still exists before displaying results
            if (this.popup) {
                this.displaySuggestions(data);
            } else {
                console.log('Popup was destroyed during API call, recreating it');
                this.recreatePopupForResults();
                if (this.popup) {
                    this.displaySuggestions(data);
                }
            }

        } catch (error) {
            console.error('Grammar check failed:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            let errorMessage = error.message;
            
            // Provide more specific error messages
            if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
                errorMessage = 'Cannot connect to Grammar Bot server. Please check if the backend is running on http://127.0.0.1:8000';
            } else if (error.message.includes('Extension context invalidated')) {
                errorMessage = 'Extension was reloaded. Please refresh the page and try again.';
            } else if (error.message.includes('Could not establish connection')) {
                errorMessage = 'Communication error with extension. Please reload the extension.';
            }
            
            // Check if popup still exists before displaying error
            if (this.popup) {
                this.displayError(errorMessage);
            } else {
                console.log('Popup was destroyed during API call, recreating it for error');
                this.recreatePopupForResults();
                if (this.popup) {
                    this.displayError(errorMessage);
                }
            }
        } finally {
            // Check if popup still exists before hiding loading
            if (this.popup && loadingEl) {
                loadingEl.style.display = 'none';
            }
            // Allow popup to be hidden again
            this.isCheckingGrammar = false;
            console.log('Grammar check completed, popup protection disabled');
        }
    }

    displaySuggestions(data) {
        if (!this.popup) {
            console.error('Cannot display suggestions: popup is null');
            return;
        }
        
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        
        if (!suggestionsEl) {
            console.error('Cannot find suggestions element in popup');
            return;
        }
        
        // Store suggestions for tracking
        this.currentSuggestions = data.suggestions || [];
        
        if (!data.has_errors || data.suggestions.length === 0) {
            suggestionsEl.innerHTML = `
                <div class="gb-no-errors">
                    <span class="gb-success-icon">✅</span>
                    <span>No grammar issues found!</span>
                </div>
            `;
        } else {
            this.renderSuggestions(suggestionsEl);
        }

        suggestionsEl.style.display = 'block';
    }

    renderSuggestions(suggestionsEl) {
        const unappliedSuggestions = this.currentSuggestions.filter((_, index) => 
            !this.appliedSuggestions.has(index)
        );
        
        const appliedCount = this.appliedSuggestions.size;
        const totalCount = this.currentSuggestions.length;
        
        if (unappliedSuggestions.length === 0 && appliedCount > 0) {
            suggestionsEl.innerHTML = `
                <div class="gb-all-applied">
                    <span class="gb-success-icon">🎉</span>
                    <span>All ${totalCount} fixes have been applied successfully!</span>
                    <div class="gb-apply-all">
                        <button class="gb-close-btn">Close</button>
                    </div>
                </div>
            `;
            
            suggestionsEl.querySelector('.gb-close-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Grammar Bot: Close button clicked from completion state');
                this.hidePopup();
            });
            return;
        }
        
        const headerText = appliedCount > 0 
            ? `Applied ${appliedCount}/${totalCount} fixes. ${unappliedSuggestions.length} remaining:`
            : `Found ${totalCount} suggestion(s):`;
            
        suggestionsEl.innerHTML = `
            <div class="gb-suggestions-header">
                <span>${headerText}</span>
            </div>
            <div class="gb-suggestions-list">
                ${this.currentSuggestions.map((suggestion, index) => {
                    const isApplied = this.appliedSuggestions.has(index);
                    return `
                        <div class="gb-suggestion-item ${isApplied ? 'gb-applied' : ''}">
                            <div class="gb-suggestion-text">
                                <span class="gb-original">"${suggestion.original_text}"</span>
                                <span class="gb-arrow">→</span>
                                <span class="gb-corrected">"${suggestion.corrected_text}"</span>
                            </div>
                            <div class="gb-suggestion-explanation">${suggestion.explanation}</div>
                            <div class="gb-suggestion-actions">
                                ${isApplied 
                                    ? '<span class="gb-applied-label">✅ Applied</span>'
                                    : `<button class="gb-apply-btn" data-index="${index}">Apply Fix</button>`
                                }
                                <span class="gb-confidence">Confidence: ${Math.round(suggestion.confidence * 100)}%</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="gb-apply-all">
                ${unappliedSuggestions.length > 0 
                    ? `<button class="gb-apply-remaining-btn">Apply ${unappliedSuggestions.length > 1 ? unappliedSuggestions.length + ' Remaining' : 'Remaining'} Fix${unappliedSuggestions.length > 1 ? 'es' : ''}</button>`
                    : ''
                }
            </div>
        `;

        // Add event listeners for apply buttons
        suggestionsEl.querySelectorAll('.gb-apply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Grammar Bot: Apply button clicked');
                const index = parseInt(e.target.dataset.index);
                this.applySuggestion(this.currentSuggestions[index], index);
            });
        });

        suggestionsEl.querySelector('.gb-apply-remaining-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Grammar Bot: Apply remaining fixes button clicked');
            this.applyRemainingFixes();
        });
    }

    displayError(message) {
        if (!this.popup) {
            console.error('Cannot display error: popup is null');
            return;
        }
        
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        
        if (!suggestionsEl) {
            console.error('Cannot find suggestions element in popup');
            return;
        }
        
        suggestionsEl.innerHTML = `
            <div class="gb-error">
                <span class="gb-error-icon">❌</span>
                <span>Error: ${message}</span>
                <div class="gb-error-details">
                    Make sure the Grammar Bot backend is running on http://127.0.0.1:8000
                </div>
            </div>
        `;
        suggestionsEl.style.display = 'block';
    }

    applySuggestion(suggestion, suggestionIndex) {
        try {
            // Set flag to prevent popup from being hidden during fix application
            this.isApplyingFix = true;
            console.log('Grammar Bot: Starting fix application, popup protection enabled');
            
            // Apply this single suggestion (DON'T mark as applied until we know it succeeded)
            let success = false;

            // Check if we're dealing with an input or textarea element
            if (this.selectedElement && (this.selectedElement.tagName === 'INPUT' || this.selectedElement.tagName === 'TEXTAREA')) {
                success = this.applySingleToInputElement(this.selectedElement, suggestion, suggestionIndex);
            } else if (this.selectionRange) {
                success = this.applySingleToTextNode(suggestion);
            }

            if (success) {
                // Mark this suggestion as applied ONLY after successful application
                this.appliedSuggestions.add(suggestionIndex);
                
                // Show brief success message
                this.showSuccessMessage('Fix applied successfully!');
                
                // Update the suggestions display to show the applied state
                const suggestionsEl = this.popup.querySelector('.gb-suggestions');
                if (suggestionsEl) {
                    this.renderSuggestions(suggestionsEl);
                }
                
                console.log(`Grammar Bot: Applied suggestion ${suggestionIndex + 1}/${this.currentSuggestions.length}`);
            } else {
                this.showErrorMessage('Failed to apply the suggestion. Please try manually.');
            }
            
        } catch (error) {
            console.error('Failed to apply suggestion:', error);
            // Remove from applied suggestions if it failed
            this.appliedSuggestions.delete(suggestionIndex);
            this.showErrorMessage('Failed to apply the suggestion. Please try manually.');
        } finally {
            // Clear the flag after a short delay to allow DOM to settle
            setTimeout(() => {
                this.isApplyingFix = false;
                console.log('Grammar Bot: Fix application completed, popup protection disabled');
            }, 100);
        }
    }

    applySingleToInputElement(element, suggestion, suggestionIndex) {
        try {
            const startPos = this.selectionStart;
            const endPos = this.selectionEnd;
            
            // Validate we have the selection positions
            if (startPos === null || endPos === null) {
                console.error('No stored selection positions for input element');
                return false;
            }
            
            // Get the current text within the selection bounds
            // Note: After previous fixes, endPos might have changed, so we need to get the actual current text
            let currentSelectedText;
            
            if (this.appliedSuggestions.size === 0) {
                // First fix - use original positions
                currentSelectedText = element.value.substring(startPos, endPos);
                this.originalSelectedText = currentSelectedText;
                console.log('Grammar Bot: First fix - using original positions');
            } else {
                // Subsequent fixes - calculate current end position based on applied changes
                const totalLengthChange = this.calculateTotalLengthChange();
                const currentEndPos = endPos + totalLengthChange;
                currentSelectedText = element.value.substring(startPos, currentEndPos);
                
                // Update our stored end position
                this.selectionEnd = currentEndPos;
                console.log('Grammar Bot: Subsequent fix - calculated end position:', currentEndPos, 'total length change:', totalLengthChange);
            }
            
            console.log('Grammar Bot: Current selected text for suggestion:', currentSelectedText);
            console.log('Grammar Bot: Looking for original text:', suggestion.original_text);
            
            // Check if the suggestion's original text exists in the current selected text
            if (!currentSelectedText.includes(suggestion.original_text)) {
                console.warn('Grammar Bot: Original text not found in current selection:', suggestion.original_text);
                console.log('Current selected text:', currentSelectedText);
                console.log('All applied suggestions so far:', Array.from(this.appliedSuggestions));
                console.log('Length changes map:', this.suggestionLengthChanges);
                return false;
            }
            
            // Apply the single suggestion to the current text
            const newText = currentSelectedText.replace(suggestion.original_text, suggestion.corrected_text);
            
            // Calculate the length difference for this fix
            const lengthDifference = suggestion.corrected_text.length - suggestion.original_text.length;
            
            // Update the input value
            const currentEndPos = this.selectionEnd;
            element.value = element.value.substring(0, startPos) + newText + element.value.substring(currentEndPos);
            
            // Update the selection end position to account for this change
            this.selectionEnd = currentEndPos + lengthDifference;
            
            // Store the length change for this suggestion for future calculations
            if (!this.suggestionLengthChanges) {
                this.suggestionLengthChanges = new Map();
            }
            this.suggestionLengthChanges.set(suggestionIndex, lengthDifference);
            
            // Restore cursor position to end of modified text
            const newCursorPos = startPos + newText.length;
            element.setSelectionRange(newCursorPos, newCursorPos);
            element.focus();
            
            console.log('Grammar Bot: Successfully applied individual suggestion:', suggestion.original_text, '→', suggestion.corrected_text);
            console.log('Length change:', lengthDifference, 'New end position:', this.selectionEnd);
            
            return true;
        } catch (error) {
            console.error('Failed to apply single suggestion to input element:', error);
            return false;
        }
    }

    calculateTotalLengthChange() {
        if (!this.suggestionLengthChanges) {
            return 0;
        }
        
        let totalChange = 0;
        for (const [index, lengthChange] of this.suggestionLengthChanges.entries()) {
            if (this.appliedSuggestions.has(index)) {
                totalChange += lengthChange;
            }
        }
        
        return totalChange;
    }

    applySingleToTextNode(suggestion) {
        try {
            // For text nodes, use the same logic as the improved applyToTextNode
            return this.applyToTextNode(suggestion);
        } catch (error) {
            console.error('Failed to apply single suggestion to text node:', error);
            return false;
        }
    }

    applyToInputElement(element, suggestion) {
        // This function is kept for backward compatibility but now redirects to the single version
        return this.applySingleToInputElement(element, suggestion);
    }

    applyToTextNode(suggestion) {
        try {
            // For text nodes, we need to work with the current text content
            // since the original selection range becomes invalid after modification
            
            // Get the current text content of the selected area
            let currentText;
            if (this.originalSelectedText) {
                // Use the stored original text and apply fixes sequentially
                currentText = this.originalSelectedText;
            } else {
                // Store the original text for subsequent fixes
                currentText = this.selectionRange.toString();
                this.originalSelectedText = currentText;
            }
            
            // Check if the suggestion still applies to the current text
            if (!currentText.includes(suggestion.original_text)) {
                console.warn('Grammar Bot: Original text not found in current content, skipping suggestion:', suggestion.original_text);
                return false;
            }
            
            // Apply the fix to our stored text
            const newText = currentText.replace(suggestion.original_text, suggestion.corrected_text);
            this.originalSelectedText = newText;
            
            // Replace the content in the DOM
            this.selectionRange.deleteContents();
            this.selectionRange.insertNode(document.createTextNode(newText));
            
            // Update the range to cover the new text
            const newRange = document.createRange();
            const textNode = this.selectionRange.startContainer.nextSibling || this.selectionRange.startContainer;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                newRange.setStart(textNode, 0);
                newRange.setEnd(textNode, newText.length);
                this.selectionRange = newRange;
            }
            
            // Clear selection visually but keep our internal range
            window.getSelection().removeAllRanges();
            
            console.log('Grammar Bot: Applied text node fix, updated stored text');
            
            return true;
        } catch (error) {
            console.error('Failed to apply to text node:', error);
            return false;
        }
    }

    applyRemainingFixes() {
        try {
            // Set flag to prevent popup from being hidden during fix application
            this.isApplyingFix = true;
            console.log('Grammar Bot: Starting remaining fixes application, popup protection enabled');
            
            // Get unapplied suggestions
            const unappliedSuggestions = this.currentSuggestions.filter((_, index) => 
                !this.appliedSuggestions.has(index)
            );
            
            if (unappliedSuggestions.length === 0) {
                this.showSuccessMessage('All fixes have already been applied!');
                return;
            }

            let success = false;

            // Check if we're dealing with an input or textarea element
            if (this.selectedElement && (this.selectedElement.tagName === 'INPUT' || this.selectedElement.tagName === 'TEXTAREA')) {
                success = this.applyAllToInputElement(this.selectedElement, unappliedSuggestions);
            } else if (this.selectionRange) {
                success = this.applyAllToTextNode(unappliedSuggestions);
            }

            if (success) {
                // Mark all remaining suggestions as applied
                this.currentSuggestions.forEach((_, index) => {
                    if (!this.appliedSuggestions.has(index)) {
                        this.appliedSuggestions.add(index);
                    }
                });
                
                this.showSuccessMessage(`Applied ${unappliedSuggestions.length} remaining fixes successfully!`);
                
                // Update the suggestions display
                const suggestionsEl = this.popup.querySelector('.gb-suggestions');
                if (suggestionsEl) {
                    this.renderSuggestions(suggestionsEl);
                }
            } else {
                this.showErrorMessage('Failed to apply remaining suggestions. Please try manually.');
            }
            
        } catch (error) {
            console.error('Failed to apply remaining suggestions:', error);
            this.showErrorMessage('Failed to apply remaining suggestions. Please try manually.');
        } finally {
            // Clear the flag after a short delay to allow DOM to settle
            setTimeout(() => {
                this.isApplyingFix = false;
                console.log('Grammar Bot: Remaining fixes application completed, popup protection disabled');
            }, 100);
        }
    }

    applyAllSuggestions(suggestions) {
        // This function is kept for backward compatibility but redirects to applyRemainingFixes
        this.applyRemainingFixes();
    }

    applyAllToInputElement(element, suggestions) {
        try {
            const startPos = this.selectionStart;
            const endPos = this.selectionEnd;
            
            // Validate we have the selection positions
            if (startPos === null || endPos === null) {
                console.error('No stored selection positions for input element');
                return false;
            }
            
            let selectedText = element.value.substring(startPos, endPos);
            
            // Apply all suggestions
            suggestions.forEach(suggestion => {
                selectedText = selectedText.replace(suggestion.original_text, suggestion.corrected_text);
            });
            
            // Update the input value
            element.value = element.value.substring(0, startPos) + selectedText + element.value.substring(endPos);
            
            // Restore cursor position
            const newCursorPos = startPos + selectedText.length;
            element.setSelectionRange(newCursorPos, newCursorPos);
            element.focus();
            
            return true;
        } catch (error) {
            console.error('Failed to apply all to input element:', error);
            return false;
        }
    }

    applyAllToTextNode(suggestions) {
        try {
            let text = this.selectionRange.toString();
            
            // Apply all suggestions
            suggestions.forEach(suggestion => {
                text = text.replace(suggestion.original_text, suggestion.corrected_text);
            });
            
            // Replace the selected text
            this.selectionRange.deleteContents();
            this.selectionRange.insertNode(document.createTextNode(text));
            
            // Clear selection
            window.getSelection().removeAllRanges();
            
            return true;
        } catch (error) {
            console.error('Failed to apply all to text node:', error);
            return false;
        }
    }

    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `gb-toast gb-toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('gb-toast-visible'), 100);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('gb-toast-visible');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    recreatePopupForResults() {
        try {
            const rect = this.getSelectionPosition();
            if (!rect) {
                console.error('Cannot recreate popup: no valid selection position');
                return;
            }

            this.popup = this.createPopup();
            this.positionPopup(rect);
            
            document.body.appendChild(this.popup);
            this.isPopupVisible = true;

            // Add fade-in animation
            setTimeout(() => {
                if (this.popup) {
                    this.popup.classList.add('gb-popup-visible');
                }
            }, 10);

            console.log('Successfully recreated popup for results');
        } catch (error) {
            console.error('Failed to recreate popup:', error);
        }
    }

    forceCleanupPopups() {
        // Remove any existing Grammar Bot popups from the page
        const existingPopups = document.querySelectorAll('.gb-popup');
        existingPopups.forEach(popup => {
            console.log('Grammar Bot: Force removing existing popup');
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        });
        
        // Reset state
        this.popup = null;
        this.isPopupVisible = false;
    }

    hidePopup() {
        if (this.popup && !this.isCheckingGrammar) {
            console.log('Grammar Bot: Hiding popup normally');
            console.log('Popup was visible for:', this.popupCreatedTime ? Date.now() - this.popupCreatedTime : 'unknown', 'ms');
            
            // Immediately remove from DOM instead of fade out
            if (this.popup.parentNode) {
                this.popup.parentNode.removeChild(this.popup);
                console.log('Grammar Bot: Popup removed from DOM');
            }
            
            this.popup = null;
            this.isPopupVisible = false;
        } else if (this.isCheckingGrammar) {
            console.log('Grammar Bot: Prevented hiding popup during grammar check');
        }
    }
}

// Initialize Grammar Bot when DOM is ready (prevent multiple instances)
if (!window.grammarBot) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.grammarBot) {
                window.grammarBot = new GrammarBot();
            }
        });
    } else {
        window.grammarBot = new GrammarBot();
    }
} else {
    console.log('Grammar Bot: Already initialized, cleaning up any existing popups');
    // Clean up any existing popups if reinitializing
    const existingPopups = document.querySelectorAll('.gb-popup');
    existingPopups.forEach(popup => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    });
} 