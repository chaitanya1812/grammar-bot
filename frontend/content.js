// Grammar Bot Content Script
class GrammarBot {
    constructor() {
        this.selectedText = '';
        this.selectionRange = null;
        this.selectedElement = null;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.popup = null;
        this.isPopupVisible = false;
        this.features = [];
        this.isCheckingGrammar = false;
        this.currentSuggestions = [];
        this.appliedSuggestions = new Set();
        this.isApplyingFix = false;
        this.originalSelectedText = null;
        this.suggestionLengthChanges = new Map();
        this.textNodeWrapper = null;
        
        this.init();
    }

    async init() {
        await this.loadFeatures();
        this.setupEventListeners();
        console.log('Grammar Bot initialized successfully');
    }

    async loadFeatures() {
        try {
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
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
        document.addEventListener('keyup', (e) => this.handleTextSelection(e));
        
        document.addEventListener('click', (e) => {
            if (!this.popup || this.isCheckingGrammar) {
                return;
            }
            
            if (!this.popup.contains(e.target)) {
                const timeSinceCreation = this.popupCreatedTime ? Date.now() - this.popupCreatedTime : Infinity;
                if (timeSinceCreation < 500) {
                    return;
                }
                this.hidePopup();
            }
        });
    }

    handleTextSelection(e) {
        setTimeout(() => {
            if (this.isCheckingGrammar || this.isApplyingFix) {
                return;
            }

            // Don't reset state if we have an active popup with applied suggestions
            if (this.isPopupVisible && this.appliedSuggestions.size > 0) {
                return;
            }

            // Reset selection data
            this.selectedElement = null;
            this.selectionStart = null;
            this.selectionEnd = null;
            this.selectionRange = null;
            this.originalSelectedText = null;
            this.suggestionLengthChanges.clear();
            this.appliedSuggestions.clear();
            
            // Clean up text node wrapper if it exists
            if (this.textNodeWrapper && this.textNodeWrapper.parentNode) {
                const parent = this.textNodeWrapper.parentNode;
                while (this.textNodeWrapper.firstChild) {
                    parent.insertBefore(this.textNodeWrapper.firstChild, this.textNodeWrapper);
                }
                parent.removeChild(this.textNodeWrapper);
            }
            this.textNodeWrapper = null;

            const activeElement = document.activeElement;
            let selectedText = '';

            // Handle input and textarea elements
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                if (start !== end) {
                    selectedText = activeElement.value.substring(start, end).trim();
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
                setTimeout(() => {
                    this.showPopup(e);
                }, 50);
            } else if (this.isPopupVisible && !this.isCheckingGrammar && !this.isApplyingFix) {
                const timeSinceCreation = this.popupCreatedTime ? Date.now() - this.popupCreatedTime : Infinity;
                if (timeSinceCreation < 500) {
                    return;
                }
                this.hidePopup();
            }
        }, 100);
    }

    showPopup(e) {
        this.forceCleanupPopups();

        const rect = this.getSelectionPosition();
        if (!rect) {
            return;
        }

        this.popup = this.createPopup();
        this.positionPopup(rect);
        
        document.body.appendChild(this.popup);
        this.isPopupVisible = true;
        this.popupCreatedTime = Date.now();

        this.popup.classList.add('gb-popup-visible');
        this.popup.style.setProperty('opacity', '1', 'important');
        this.popup.style.setProperty('transform', 'translateY(0)', 'important');
    }

    getSelectionPosition() {
        // Use stored element if available (for input/textarea)
        if (this.selectedElement && (this.selectedElement.tagName === 'INPUT' || this.selectedElement.tagName === 'TEXTAREA')) {
            const rect = this.selectedElement.getBoundingClientRect();
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
                this.hidePopup();
            });
        }
        
        return popup;
    }

    positionPopup(rect) {
        const popup = this.popup;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const popupWidth = 320;
        const popupHeight = 400;
        const padding = 10;
        const margin = 10;

        // Calculate initial position (below the selection)
        let top = rect.bottom + padding;
        let left = rect.left;

        // Adjust horizontal position if popup would go off-screen
        if (left + popupWidth > viewportWidth - margin) {
            left = rect.right - popupWidth;
            
            if (left < margin) {
                left = viewportWidth - popupWidth - margin;
            }
        }
        
        if (left < margin) {
            left = margin;
        }

        // Adjust vertical position if popup would go off-screen
        if (top + popupHeight > viewportHeight - margin) {
            top = rect.top - popupHeight - padding;
            
            if (top < margin) {
                top = viewportHeight - popupHeight - margin;
            }
        }
        
        if (top < margin) {
            top = margin;
        }

        popup.style.setProperty('top', `${top}px`, 'important');
        popup.style.setProperty('left', `${left}px`, 'important');
        popup.style.setProperty('position', 'fixed', 'important');
        
        // Add fallback positioning if out of bounds
        if (top < 0 || top > viewportHeight || left < 0 || left > viewportWidth) {
            popup.style.setProperty('top', '50px', 'important');
            popup.style.setProperty('left', '50px', 'important');
        }
    }

    async checkGrammar(feature = 'grammar_check') {
        if (!this.popup) {
            console.error('Grammar check failed: popup is null');
            return;
        }

        const loadingEl = this.popup.querySelector('.gb-loading');
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        const featuresEl = this.popup.querySelector('.gb-features');

        if (!loadingEl || !suggestionsEl || !featuresEl) {
            console.error('Grammar check failed: popup elements not found');
            return;
        }

        // Reset applied suggestions for new check
        this.appliedSuggestions.clear();
        this.originalSelectedText = null;
        
        this.isCheckingGrammar = true;

        // Show loading state
        featuresEl.style.display = 'none';
        suggestionsEl.style.display = 'none';
        loadingEl.style.display = 'flex';

        try {
            const data = await chrome.runtime.sendMessage({
                action: 'checkGrammar',
                data: {
                    text: this.selectedText,
                    feature: feature
                }
            });

            if (data.error) {
                throw new Error(data.error);
            }

            // Hide loading and show results
            loadingEl.style.display = 'none';
            
            if (!this.popup) {
                this.recreatePopupForResults();
            }
            
            this.displaySuggestions(data);

        } catch (error) {
            console.error('Grammar check failed:', error);
            
            // Hide loading
            loadingEl.style.display = 'none';
            
            if (!this.popup) {
                this.recreatePopupForResults();
            }
            
            this.displayError(`Failed to check grammar: ${error.message}`);
        } finally {
            this.isCheckingGrammar = false;
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
                const index = parseInt(e.target.dataset.index);
                this.applySuggestion(this.currentSuggestions[index], index);
            });
        });

        suggestionsEl.querySelector('.gb-apply-remaining-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
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
            this.isApplyingFix = true;
            
            let success = false;

            if (this.selectedElement && (this.selectedElement.tagName === 'INPUT' || this.selectedElement.tagName === 'TEXTAREA')) {
                success = this.applySingleToInputElement(this.selectedElement, suggestion, suggestionIndex);
            } else if (this.selectionRange) {
                success = this.applySingleToTextNode(suggestion);
            }

            if (success) {
                this.appliedSuggestions.add(suggestionIndex);
                this.showSuccessMessage('Fix applied successfully!');
                
                const suggestionsEl = this.popup.querySelector('.gb-suggestions');
                if (suggestionsEl) {
                    this.renderSuggestions(suggestionsEl);
                }
            } else {
                this.showErrorMessage('Failed to apply the suggestion. Please try manually.');
            }
            
        } catch (error) {
            console.error('Failed to apply suggestion:', error);
            this.appliedSuggestions.delete(suggestionIndex);
            this.showErrorMessage('Failed to apply the suggestion. Please try manually.');
        } finally {
            setTimeout(() => {
                this.isApplyingFix = false;
            }, 200);
        }
    }

    applySingleToInputElement(element, suggestion, suggestionIndex) {
        try {
            const startPos = this.selectionStart;
            const endPos = this.selectionEnd;
            
            if (startPos === null || endPos === null) {
                console.error('No stored selection positions for input element');
                return false;
            }
            
            const currentText = element.value;
            const totalLengthChange = this.calculateTotalLengthChange();
            const currentEndPos = endPos + totalLengthChange;
            
            let currentSelectedText = currentText.substring(startPos, currentEndPos);
            
            if (this.appliedSuggestions.size === 0) {
                this.originalSelectedText = currentSelectedText;
            }
            
            const originalTextIndex = currentSelectedText.indexOf(suggestion.original_text);
            if (originalTextIndex === -1) {
                return false;
            }
            
            const absoluteStartPos = startPos + originalTextIndex;
            const absoluteEndPos = absoluteStartPos + suggestion.original_text.length;
            
            const newValue = currentText.substring(0, absoluteStartPos) + 
                            suggestion.corrected_text + 
                            currentText.substring(absoluteEndPos);
            
            element.value = newValue;
            
            const lengthDifference = suggestion.corrected_text.length - suggestion.original_text.length;
            this.selectionEnd = currentEndPos + lengthDifference;
            
            if (!this.suggestionLengthChanges) {
                this.suggestionLengthChanges = new Map();
            }
            this.suggestionLengthChanges.set(suggestionIndex, lengthDifference);
            
            const newCursorPos = absoluteStartPos + suggestion.corrected_text.length;
            element.setSelectionRange(newCursorPos, newCursorPos);
            
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
            return this.applyToTextNode(suggestion);
        } catch (error) {
            console.error('Failed to apply single suggestion to text node:', error);
            return false;
        }
    }

    applyToInputElement(element, suggestion) {
        return this.applySingleToInputElement(element, suggestion);
    }

    applyToTextNode(suggestion) {
        try {
            if (!this.selectionRange) {
                console.error('No selection range available for text node fix');
                return false;
            }
            
            // For the first fix, store the original content and create wrapper
            if (this.appliedSuggestions.size === 0) {
                this.originalSelectedText = this.selectionRange.toString();
                
                const wrapper = document.createElement('span');
                wrapper.className = 'gb-temp-wrapper';
                wrapper.style.cssText = 'display: inline; background: transparent; border: none; margin: 0; padding: 0;';
                
                const originalContent = this.selectionRange.extractContents();
                wrapper.appendChild(originalContent);
                
                this.selectionRange.insertNode(wrapper);
                this.textNodeWrapper = wrapper;
            }
            
            if (!this.textNodeWrapper || !this.textNodeWrapper.parentNode) {
                console.error('Text node wrapper not available or removed from DOM');
                return false;
            }
            
            const currentText = this.textNodeWrapper.textContent;
            
            const originalTextIndex = currentText.indexOf(suggestion.original_text);
            if (originalTextIndex === -1) {
                return false;
            }
            
            const newText = currentText.substring(0, originalTextIndex) + 
                           suggestion.corrected_text + 
                           currentText.substring(originalTextIndex + suggestion.original_text.length);
            
            this.textNodeWrapper.textContent = newText;
            
            return true;
        } catch (error) {
            console.error('Failed to apply to text node:', error);
            return false;
        }
    }

    applyRemainingFixes() {
        try {
            this.isApplyingFix = true;
            
            const unappliedSuggestions = this.currentSuggestions.filter((_, index) => 
                !this.appliedSuggestions.has(index)
            );

            if (unappliedSuggestions.length === 0) {
                this.showSuccessMessage('No remaining fixes to apply.');
                return;
            }

            let appliedCount = 0;
            
            for (let i = 0; i < this.currentSuggestions.length; i++) {
                if (!this.appliedSuggestions.has(i)) {
                    const suggestion = this.currentSuggestions[i];
                    let success = false;

                    if (this.selectedElement && (this.selectedElement.tagName === 'INPUT' || this.selectedElement.tagName === 'TEXTAREA')) {
                        success = this.applySingleToInputElement(this.selectedElement, suggestion, i);
                    } else if (this.selectionRange || this.textNodeWrapper) {
                        success = this.applySingleToTextNode(suggestion);
                    }

                    if (success) {
                        this.appliedSuggestions.add(i);
                        appliedCount++;
                    }
                }
            }

            this.showSuccessMessage(`Applied ${appliedCount} fix${appliedCount !== 1 ? 'es' : ''} successfully!`);
            
            const suggestionsEl = this.popup.querySelector('.gb-suggestions');
            if (suggestionsEl) {
                this.renderSuggestions(suggestionsEl);
            }

        } catch (error) {
            console.error('Failed to apply remaining suggestions:', error);
            this.showErrorMessage('Failed to apply some suggestions. Please try individually.');
        } finally {
            setTimeout(() => {
                this.isApplyingFix = false;
            }, 200);
        }
    }

    // Kept for compatibility but redirects to new methods
    applyAllSuggestions(suggestions) {
        this.applyRemainingFixes();
    }

    applyAllToInputElement(element, suggestions) {
        if (!element || suggestions.length === 0) {
            console.error('No stored selection positions for input element');
            return false;
        }

        try {
            suggestions.forEach((suggestion, index) => {
                if (!this.appliedSuggestions.has(index)) {
                    this.applySingleToInputElement(element, suggestion, index);
                    this.appliedSuggestions.add(index);
                }
            });
            return true;
        } catch (error) {
            console.error('Failed to apply all to input element:', error);
            return false;
        }
    }

    applyAllToTextNode(suggestions) {
        try {
            suggestions.forEach((suggestion, index) => {
                if (!this.appliedSuggestions.has(index)) {
                    this.applySingleToTextNode(suggestion);
                    this.appliedSuggestions.add(index);
                }
            });
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
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 2147483648;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white; padding: 12px 16px; border-radius: 4px;
            font-family: Arial, sans-serif; font-size: 14px;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    recreatePopupForResults() {
        const rect = this.getSelectionPosition();
        if (!rect) {
            console.error('Cannot recreate popup: no valid selection position');
            return;
        }

        try {
            this.popup = this.createPopup();
            this.positionPopup(rect);
            document.body.appendChild(this.popup);
            this.isPopupVisible = true;
            this.popupCreatedTime = Date.now();
            
            this.popup.classList.add('gb-popup-visible');
            this.popup.style.setProperty('opacity', '1', 'important');
            this.popup.style.setProperty('transform', 'translateY(0)', 'important');
        } catch (error) {
            console.error('Failed to recreate popup:', error);
        }
    }

    forceCleanupPopups() {
        const existingPopups = document.querySelectorAll('.gb-popup');
        existingPopups.forEach(popup => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        });
        
        this.popup = null;
        this.isPopupVisible = false;
    }

    hidePopup() {
        if (this.popup && !this.isCheckingGrammar) {
            if (this.popup.parentNode) {
                this.popup.parentNode.removeChild(this.popup);
            }
            
            this.popup = null;
            this.isPopupVisible = false;
            
            // Clean up text node wrapper when hiding popup
            if (this.textNodeWrapper && this.textNodeWrapper.parentNode) {
                const parent = this.textNodeWrapper.parentNode;
                while (this.textNodeWrapper.firstChild) {
                    parent.insertBefore(this.textNodeWrapper.firstChild, this.textNodeWrapper);
                }
                parent.removeChild(this.textNodeWrapper);
            }
            this.textNodeWrapper = null;
        }
    }
}

// Initialize Grammar Bot when DOM is ready
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
    // Clean up any existing popups if reinitializing
    const existingPopups = document.querySelectorAll('.gb-popup');
    existingPopups.forEach(popup => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    });
} 