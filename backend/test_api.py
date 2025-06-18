#!/usr/bin/env python3
"""
Test script for Grammar Bot API
Run this to verify your backend is working correctly
"""

import requests
import json
import sys
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test the basic health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_features_endpoint():
    """Test the features endpoint"""
    print("\n🔍 Testing features endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/features")
        if response.status_code == 200:
            data = response.json()
            print("✅ Features endpoint working")
            print(f"   Available features: {len(data['features'])}")
            for feature in data['features']:
                status = "✅" if feature['enabled'] else "⏳"
                print(f"   {status} {feature['name']}: {feature['description']}")
            return True
        else:
            print(f"❌ Features endpoint failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Features endpoint failed: {e}")
        return False

def test_grammar_check():
    """Test the grammar check endpoint"""
    print("\n🔍 Testing grammar check endpoint...")
    
    # Test data with intentional errors
    test_texts = [
        "This are a test sentence with grammar error.",
        "I can haz cheezburger?",
        "The quick brown fox jumps over the lazy dog.",  # No errors
    ]
    
    for i, text in enumerate(test_texts, 1):
        print(f"\n   Test {i}: '{text}'")
        try:
            response = requests.post(
                f"{BASE_URL}/check-grammar",
                json={"text": text, "feature": "grammar_check"},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['has_errors']:
                    print(f"   ✅ Found {len(data['suggestions'])} suggestions:")
                    for suggestion in data['suggestions']:
                        print(f"      • '{suggestion['original_text']}' → '{suggestion['corrected_text']}'")
                        print(f"        Reason: {suggestion['explanation']}")
                else:
                    print("   ✅ No errors found (text is correct)")
            else:
                print(f"   ❌ Request failed with status {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ Request failed: {e}")
            return False
    
    return True

def check_environment():
    """Check if environment is properly configured"""
    print("🔍 Checking environment configuration...")
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY not found in environment")
        print("   Please create a .env file with your Gemini API key")
        return False
    elif api_key == "your_gemini_api_key_here":
        print("❌ GEMINI_API_KEY is still set to placeholder value")
        print("   Please update your .env file with your actual API key")
        return False
    else:
        print("✅ GEMINI_API_KEY found and configured")
        return True

def main():
    """Run all tests"""
    print("🚀 Starting Grammar Bot API Tests\n")
    print("=" * 50)
    
    # Check environment
    if not check_environment():
        print("\n❌ Environment check failed. Please fix and try again.")
        sys.exit(1)
    
    # Run tests
    tests = [
        ("Health Check", test_health_check),
        ("Features Endpoint", test_features_endpoint),
        ("Grammar Check", test_grammar_check),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        result = test_func()
        results.append((test_name, result))
    
    # Summary
    print(f"\n{'='*50}")
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    all_passed = True
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if not result:
            all_passed = False
    
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 All tests passed! Your Grammar Bot backend is ready to use.")
        print("\nNext steps:")
        print("1. Load the Chrome extension from the 'frontend' folder")
        print("2. Try selecting text on any webpage")
        print("3. Use the Grammar Check feature")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")
        print("\nCommon fixes:")
        print("- Make sure the server is running (python3 main.py)")
        print("- Check your Gemini API key in the .env file")
        print("- Verify internet connection")
    
    print("\n" + "=" * 50)

if __name__ == "__main__":
    main() 