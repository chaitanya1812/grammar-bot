# AI Prompt Templates for Grammar Bot

PROMPTS = {
    # Grammar Check Prompts
    "grammar_check": """
    You are a professional grammar and spelling checker. Analyze the following text and provide corrections.
    
    Text: "{text}"
    
    Please respond in the following JSON format:
    {{
        "suggestions": [
            {{
                "original_text": "exact portion that needs correction",
                "corrected_text": "corrected version",
                "explanation": "brief explanation of the error",
                "confidence": 0.95
            }}
        ],
        "has_errors": true/false
    }}
    
    IMPORTANT RULES:
    1. Only suggest corrections for actual grammar, spelling, case or punctuation errors
    2. If the text is already correct, return "has_errors": false with an empty suggestions array
    3. Keep explanations concise and helpful
    4. CRITICAL: When correcting punctuation, be precise and do not add redundant punctuation and NEVER remove all punctuation unless it's truly wrong.
    5. Focus on fixing the actual error, preserve correct punctuation
    6. When in doubt, preserve existing punctuation rather than removing it
    7. IMPORTANT: The "corrected_text" will be used EXACTLY to replace the "original_text" in the user's document. Make sure "corrected_text" contains exactly what should appear in the final text, including all necessary punctuation.
    8. If the change is small just try to keep the necessary word(s) which needs to be changed. for example if only one word is wrong, then just give the correct word. If the change is to add a punctuation, then give it with the last word as needed.
    9. When there is no lack of context for a sentence, then don't return any suggestion for that.
    """,
    
    "spell_check": """
    You are a spell checker. Focus only on spelling errors in the following text:
    
    Text: "{text}"
    
    Respond in JSON format with spelling corrections only.
    """,
    
    "improve_sentence": """
    You are a writing assistant. Improve the clarity and flow of this sentence while maintaining its original meaning:
    
    Text: "{text}"
    
    Provide an improved version with explanation.
    """,
    
    "change_tone": """
    You are a tone adjustment assistant. Modify the tone of this text to be more professional:
    
    Text: "{text}"
    
    Provide the text with adjusted tone.
    """,
    
    # Smart Text Assistant Prompts - Optimized for Frontend Text Selection
    "explain": """
    You are a helpful text explanation assistant. The user has selected some text and wants it explained in simpler terms.
    
    Selected text: "{text}"
    
    Please provide a clear, easy-to-understand explanation that:
    1. Breaks down any difficult, technical, or jargon words and explains their meanings
    2. Explains the overall meaning and context of the text
    3. Uses simpler language that anyone can understand
    4. Provides relevant background information if helpful
    
    Keep your explanation friendly, conversational, and accessible. Focus on making complex ideas simple and clear.
    """,
    
    "summarize": """
    You are a text summarization expert. The user has selected text that they want summarized into key points.
    
    Text to summarize: "{text}"
    
    Please provide a concise summary that:
    1. Captures the main points and key information (aim for ~10% of original length)
    2. Maintains the essential meaning and context
    3. Is written in clear, accessible language
    4. Uses bullet points or numbered lists when appropriate
    5. Focuses on the most important information and omits unnecessary details
    
    Make it easy to quickly understand what the original text was about.
    """,
    
    "custom": """
    You are a helpful AI assistant. The user has selected some text and has a specific question or request about it.
    
    Selected text: "{text}"
    User's question/request: "{custom_prompt}"
    
    Please respond helpfully to the user's question about the selected text. Be:
    - Clear and concise
    - Accurate and informative  
    - Friendly and conversational
    - Focused on what the user specifically asked for
    
    If the user's request is unclear, do your best to provide a useful response based on what you think they're asking for.
    """
} 