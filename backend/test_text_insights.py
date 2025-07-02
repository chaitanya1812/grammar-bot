#!/usr/bin/env python3
"""
Test script for the Smart Text Assistant (Text Insights) API

This script tests the refactored, clean backend code structure.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_explain_action():
    """Test the explain action with technical jargon"""
    print("🧠 Testing EXPLAIN action...")
    
    text = """
    The algorithm leverages machine learning paradigms to optimize the computational complexity 
    of neural network architectures through gradient descent and backpropagation mechanisms.
    """
    
    payload = {
        "text": text.strip(),
        "action": "explain"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/text-insights", json=payload)
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"Original: {result['original_text'][:100]}...")
            print(f"Explanation: {result['result']}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    
    print("-" * 80)

def test_summarize_action():
    """Test the summarize action with a longer text"""
    print("📋 Testing SUMMARIZE action...")
    
    text = """
    Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals. Colloquially, the term "artificial intelligence" is often used to describe machines that mimic "cognitive" functions that humans associate with the human mind, such as "learning" and "problem solving".

    The scope of AI is disputed: as machines become increasingly capable, tasks considered to require "intelligence" are often removed from the definition of AI, a phenomenon known as the AI effect. A quip in Tesler's Theorem says "AI is whatever hasn't been done yet." For instance, optical character recognition is frequently excluded from things considered to be AI, having become a routine technology. Modern machine capabilities generally classified as AI include successfully understanding human speech, competing at the highest level in strategic game systems, autonomously operating cars, intelligent routing in content delivery networks, and military simulations.

    Artificial intelligence was founded as an academic discipline in 1956, and in the years since has experienced several waves of optimism, followed by disappointment and the loss of funding (known as an "AI winter"), followed by new approaches, success and renewed funding. For most of its history, AI research has been divided into sub-fields that often fail to communicate with each other.
    """
    
    payload = {
        "text": text.strip(),
        "action": "summarize"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/text-insights", json=payload)
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"Original length: {len(result['original_text'])} characters")
            print(f"Summary length: {len(result['result'])} characters")
            print(f"Reduction: {100 - (len(result['result']) / len(result['original_text']) * 100):.1f}%")
            print(f"Summary: {result['result']}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    
    print("-" * 80)

def test_custom_action():
    """Test the custom action with a user-defined prompt"""
    print("✏️ Testing CUSTOM action...")
    
    text = """
    "The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet."
    """
    
    custom_prompt = "Analyze this text and tell me what makes it special or unique."
    
    payload = {
        "text": text.strip(),
        "action": "custom",
        "custom_prompt": custom_prompt
    }
    
    try:
        response = requests.post(f"{BASE_URL}/text-insights", json=payload)
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"Text: {result['original_text']}")
            print(f"Custom prompt: {result['custom_prompt']}")
            print(f"Response: {result['result']}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    
    print("-" * 80)

def test_features_endpoint():
    """Test the features endpoint to see if Smart Text Assistant is listed"""
    print("🔍 Testing FEATURES endpoint...")
    
    try:
        response = requests.get(f"{BASE_URL}/features")
        if response.status_code == 200:
            features = response.json()["features"]
            print("✅ Available features:")
            for feature in features:
                status = "✅" if feature["enabled"] else "⏸️"
                print(f"  {status} {feature['icon']} {feature['name']}: {feature['description']}")
                
                # Show actions for Smart Text Assistant
                if "actions" in feature:
                    for action in feature["actions"]:
                        print(f"    └─ {action['icon']} {action['name']}: {action['description']}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    
    print("-" * 80)

def main():
    print("🚀 Testing Smart Text Assistant API")
    print("=" * 80)
    
    # Test if server is running
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code != 200:
            print("❌ Server is not running. Please start the backend first:")
            print("   cd backend && python main.py")
            return
    except requests.exceptions.RequestException:
        print("❌ Cannot connect to server. Please start the backend first:")
        print("   cd backend && python main.py")
        return
    
    print("✅ Server is running!")
    print()
    
    # Run all tests
    test_features_endpoint()
    test_explain_action()
    test_summarize_action()
    test_custom_action()
    
    print("🎉 All tests completed!")

if __name__ == "__main__":
    main() 