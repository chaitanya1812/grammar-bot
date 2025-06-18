// Grammar Bot Content Script
class GrammarBot {
    constructor() {
        this.selectedText = '';
        this.selectionRange = null;
        this.popup = null;
        this.isPopupVisible = false;
        this.features = [];
        
        this.init();
    }

    async init() {
        // Load features from backend
        await this.loadFeatures();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Grammar Bot initialized');
    }

    async loadFeatures() {
        try {
            const response = await fetch('http://localhost:8000/features');
            const data = await response.json();
            this.features = data.features.filter(f => f.enabled);
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
            if (this.popup && !this.popup.contains(e.target)) {
                this.hidePopup();
            }
        });

        // Hide popup on scroll
        document.addEventListener('scroll', () => {
            if (this.isPopupVisible) {
                this.hidePopup();
            }
        });
    }

    handleTextSelection(e) {
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText && selectedText.length > 3) {
                this.selectedText = selectedText;
                this.selectionRange = selection.getRangeAt(0);
                this.showPopup(e);
            } else if (this.isPopupVisible) {
                this.hidePopup();
            }
        }, 100);
    }

    showPopup(e) {
        this.hidePopup(); // Hide any existing popup

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        this.popup = this.createPopup();
        this.positionPopup(rect);
        
        document.body.appendChild(this.popup);
        this.isPopupVisible = true;

        // Add fade-in animation
        setTimeout(() => {
            this.popup.classList.add('gb-popup-visible');
        }, 10);
    }

    createPopup() {
        const popup = document.createElement('div');
        popup.className = 'gb-popup';
        popup.innerHTML = `
            <div class="gb-popup-header">
                <span class="gb-popup-title">Grammar Bot</span>
                <button class="gb-popup-close" onclick="grammarBot.hidePopup()">×</button>
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
                const feature = e.currentTarget.dataset.feature;
                this.checkGrammar(feature);
            });
        });

        return popup;
    }

    positionPopup(rect) {
        const popup = this.popup;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollTop = window.pageYOffset;
        const scrollLeft = window.pageXOffset;

        // Calculate position
        let top = rect.bottom + scrollTop + 10;
        let left = rect.left + scrollLeft;

        // Adjust if popup would go off-screen
        const popupRect = popup.getBoundingClientRect();
        
        if (left + 320 > viewportWidth + scrollLeft) {
            left = rect.right + scrollLeft - 320;
        }
        
        if (top + 200 > viewportHeight + scrollTop) {
            top = rect.top + scrollTop - 200;
        }

        popup.style.top = `${Math.max(0, top)}px`;
        popup.style.left = `${Math.max(0, left)}px`;
    }

    async checkGrammar(feature = 'grammar_check') {
        const loadingEl = this.popup.querySelector('.gb-loading');
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        const featuresEl = this.popup.querySelector('.gb-features');

        // Show loading state
        featuresEl.style.display = 'none';
        suggestionsEl.style.display = 'none';
        loadingEl.style.display = 'flex';

        try {
            const response = await fetch('http://localhost:8000/check-grammar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: this.selectedText,
                    feature: feature
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.displaySuggestions(data);

        } catch (error) {
            console.error('Grammar check failed:', error);
            this.displayError(error.message);
        } finally {
            loadingEl.style.display = 'none';
        }
    }

    displaySuggestions(data) {
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        
        if (!data.has_errors || data.suggestions.length === 0) {
            suggestionsEl.innerHTML = `
                <div class="gb-no-errors">
                    <span class="gb-success-icon">✅</span>
                    <span>No grammar issues found!</span>
                </div>
            `;
        } else {
            suggestionsEl.innerHTML = `
                <div class="gb-suggestions-header">
                    <span>Found ${data.suggestions.length} suggestion(s):</span>
                </div>
                <div class="gb-suggestions-list">
                    ${data.suggestions.map((suggestion, index) => `
                        <div class="gb-suggestion-item">
                            <div class="gb-suggestion-text">
                                <span class="gb-original">"${suggestion.original_text}"</span>
                                <span class="gb-arrow">→</span>
                                <span class="gb-corrected">"${suggestion.corrected_text}"</span>
                            </div>
                            <div class="gb-suggestion-explanation">${suggestion.explanation}</div>
                            <div class="gb-suggestion-actions">
                                <button class="gb-apply-btn" data-index="${index}">Apply Fix</button>
                                <span class="gb-confidence">Confidence: ${Math.round(suggestion.confidence * 100)}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="gb-apply-all">
                    <button class="gb-apply-all-btn">Apply All Fixes</button>
                </div>
            `;

            // Add event listeners for apply buttons
            suggestionsEl.querySelectorAll('.gb-apply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.applySuggestion(data.suggestions[index]);
                });
            });

            suggestionsEl.querySelector('.gb-apply-all-btn')?.addEventListener('click', () => {
                this.applyAllSuggestions(data.suggestions);
            });
        }

        suggestionsEl.style.display = 'block';
    }

    displayError(message) {
        const suggestionsEl = this.popup.querySelector('.gb-suggestions');
        suggestionsEl.innerHTML = `
            <div class="gb-error">
                <span class="gb-error-icon">❌</span>
                <span>Error: ${message}</span>
                <div class="gb-error-details">
                    Make sure the Grammar Bot backend is running on http://localhost:8000
                </div>
            </div>
        `;
        suggestionsEl.style.display = 'block';
    }

    applySuggestion(suggestion) {
        if (!this.selectionRange) return;

        try {
            // Find the text in the current selection and replace it
            const selectedText = this.selectionRange.toString();
            const newText = selectedText.replace(suggestion.original_text, suggestion.corrected_text);
            
            // Replace the selected text
            this.selectionRange.deleteContents();
            this.selectionRange.insertNode(document.createTextNode(newText));
            
            // Clear selection and hide popup
            window.getSelection().removeAllRanges();
            this.hidePopup();
            
            // Show success message
            this.showSuccessMessage('Text updated successfully!');
            
        } catch (error) {
            console.error('Failed to apply suggestion:', error);
            this.showErrorMessage('Failed to apply the suggestion. Please try manually.');
        }
    }

    applyAllSuggestions(suggestions) {
        if (!this.selectionRange) return;

        try {
            let text = this.selectionRange.toString();
            
            // Apply all suggestions
            suggestions.forEach(suggestion => {
                text = text.replace(suggestion.original_text, suggestion.corrected_text);
            });
            
            // Replace the selected text
            this.selectionRange.deleteContents();
            this.selectionRange.insertNode(document.createTextNode(text));
            
            // Clear selection and hide popup
            window.getSelection().removeAllRanges();
            this.hidePopup();
            
            // Show success message
            this.showSuccessMessage(`Applied ${suggestions.length} fixes successfully!`);
            
        } catch (error) {
            console.error('Failed to apply suggestions:', error);
            this.showErrorMessage('Failed to apply suggestions. Please try manually.');
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

    hidePopup() {
        if (this.popup) {
            this.popup.classList.remove('gb-popup-visible');
            setTimeout(() => {
                if (this.popup && this.popup.parentNode) {
                    this.popup.parentNode.removeChild(this.popup);
                }
                this.popup = null;
                this.isPopupVisible = false;
            }, 200);
        }
    }
}

// Initialize Grammar Bot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.grammarBot = new GrammarBot();
    });
} else {
    window.grammarBot = new GrammarBot();
} 