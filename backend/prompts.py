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
    
    # Smart Text Assistant Prompts
    "explain": """
    You are a helpful text explanation assistant. Your task is to explain the given text in a clear, easy-to-understand way.
    Break down difficult words, jargon, concepts, or sentences. Provide context where helpful.
    
    Text to explain: "{text}"
    
    Please provide a clear explanation that helps the reader understand:
    1. Any difficult or technical words and their meanings
    2. The overall meaning of the text
    3. Any relevant context that would help understanding
    
    Keep your explanation concise but comprehensive. Aim for clarity over brevity.
    """,
    
    "summarize": """
    You are a text summarization expert. Your task is to create a concise summary of the given text.
    Reduce the text to approximately 10% of its original length while preserving the key information and main ideas.
    
    Text to summarize: "{text}"
    
    Please provide a summary that:
    1. Captures the main points and key information
    2. Is significantly shorter than the original (aim for ~10% of original length)
    3. Maintains the essential meaning and context
    4. Is written in clear, accessible language
    
    Focus on the most important information and omit unnecessary details.
    """,
    
    "custom": """
    You are a helpful AI assistant. The user has selected some text and wants you to perform a specific action on it.
    
    Selected text: "{text}"
    User's request: "{custom_prompt}"
    
    Please respond to the user's request regarding the selected text. Be helpful, accurate, and concise.
    """
} 