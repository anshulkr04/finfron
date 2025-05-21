#!/usr/bin/env python3
import requests
import json
import time
import random
import string
import uuid
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5001/api"  # Change according to your server configuration
TEST_EMAIL = f"test_user_{int(time.time())}@example.com"  # Generate a unique email
TEST_PASSWORD = "Test@123"
TEST_ISINS = [
    "US0378331005",  # Apple
    "US5949181045",  # Microsoft
    "US0231351067",  # Amazon
    "US02079K1079",  # Alphabet (Google)
    "US30303M1027",  # Meta (Facebook)
    "US88160R1014",  # Tesla
    "US0846707026",  # Berkshire Hathaway
    "US67066G1040",  # NVIDIA
    "US4581401001",  # Intel
    "US4370761029",  # Home Depot
]
TEST_CATEGORIES = ["Tech", "Financial", "Healthcare", "Consumer", "Energy"]

# Store auth token and user_id
auth_token = None
user_id = None

# Helper functions
def log_response(response, message):
    """Log the response details"""
    try:
        print(f"\n{message}")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.json()
    except Exception as e:
        print(f"Error parsing response: {e}")
        print(f"Raw response: {response.text}")
        return None

def register_user():
    """Register a new user for testing"""
    global auth_token, user_id
    
    print(f"\n[TEST] Registering user: {TEST_EMAIL}")
    response = requests.post(
        f"{BASE_URL}/register",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "account_type": "free"
        }
    )
    
    data = log_response(response, "Registration Response:")
    
    if response.status_code == 201 and data:
        auth_token = data.get("token")
        user_id = data.get("user_id")
        print(f"✅ User registered successfully. User ID: {user_id}")
        return True
    else:
        print("❌ User registration failed")
        return False

def login_user():
    """Login the test user"""
    global auth_token, user_id
    
    print(f"\n[TEST] Logging in user: {TEST_EMAIL}")
    response = requests.post(
        f"{BASE_URL}/login",
        json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }
    )
    
    data = log_response(response, "Login Response:")
    
    if response.status_code == 200 and data:
        auth_token = data.get("token")
        user_id = data.get("user_id")
        print(f"✅ User logged in successfully. User ID: {user_id}")
        return True
    else:
        print("❌ User login failed")
        return False

def get_watchlists():
    """Get all watchlists for the user"""
    print("\n[TEST] Getting all watchlists")
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.get(f"{BASE_URL}/watchlist", headers=headers)
    
    data = log_response(response, "Get Watchlists Response:")
    
    if response.status_code == 200 and data and "watchlists" in data:
        print(f"✅ Got {len(data['watchlists'])} watchlists")
        return data["watchlists"]
    else:
        print("❌ Failed to get watchlists")
        return []

def create_watchlist(name):
    """Create a new watchlist"""
    print(f"\n[TEST] Creating watchlist: {name}")
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(
        f"{BASE_URL}/watchlist",
        headers=headers,
        json={
            "operation": "create",
            "watchlistName": name
        }
    )
    
    data = log_response(response, "Create Watchlist Response:")
    
    if response.status_code == 201 and data and "watchlist" in data:
        watchlist_id = data["watchlist"]["_id"]
        print(f"✅ Watchlist created. ID: {watchlist_id}")
        return watchlist_id
    else:
        print("❌ Failed to create watchlist")
        return None

def add_isin(watchlist_id, isin, category=None):
    """Add an ISIN to a watchlist"""
    print(f"\n[TEST] Adding ISIN {isin} to watchlist {watchlist_id}")
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    payload = {
        "operation": "add_isin",
        "watchlist_id": watchlist_id,
        "isin": isin
    }
    
    if category:
        payload["category"] = category
        print(f"With category: {category}")
    
    response = requests.post(
        f"{BASE_URL}/watchlist",
        headers=headers,
        json=payload
    )
    
    data = log_response(response, "Add ISIN Response:")
    
    if response.status_code in [201, 200] and data:
        print(f"✅ ISIN {isin} added to watchlist")
        return True
    else:
        print(f"❌ Failed to add ISIN {isin} to watchlist")
        return False

def remove_isin(watchlist_id, isin):
    """Remove an ISIN from a watchlist"""
    print(f"\n[TEST] Removing ISIN {isin} from watchlist {watchlist_id}")
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.delete(
        f"{BASE_URL}/watchlist/{watchlist_id}/isin/{isin}",
        headers=headers
    )
    
    data = log_response(response, "Remove ISIN Response:")
    
    if response.status_code == 200 and data:
        print(f"✅ ISIN {isin} removed from watchlist")
        return True
    else:
        print(f"❌ Failed to remove ISIN {isin} from watchlist")
        return False

def clear_watchlist(watchlist_id):
    """Clear all ISINs from a watchlist"""
    print(f"\n[TEST] Clearing watchlist {watchlist_id}")
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(
        f"{BASE_URL}/watchlist/{watchlist_id}/clear",
        headers=headers
    )
    
    data = log_response(response, "Clear Watchlist Response:")
    
    if response.status_code == 200 and data:
        print(f"✅ Watchlist {watchlist_id} cleared")
        return True
    else:
        print(f"❌ Failed to clear watchlist {watchlist_id}")
        return False

def delete_watchlist(watchlist_id):
    """Delete a watchlist"""
    print(f"\n[TEST] Deleting watchlist {watchlist_id}")
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.delete(
        f"{BASE_URL}/watchlist/{watchlist_id}",
        headers=headers
    )
    
    data = log_response(response, "Delete Watchlist Response:")
    
    if response.status_code == 200 and data:
        print(f"✅ Watchlist {watchlist_id} deleted")
        return True
    else:
        print(f"❌ Failed to delete watchlist {watchlist_id}")
        return False

def verify_isin_in_watchlist(watchlist_id, isin, watchlists=None):
    """Verify if an ISIN is in a watchlist"""
    if watchlists is None:
        watchlists = get_watchlists()
    
    for watchlist in watchlists:
        if watchlist["_id"] == watchlist_id:
            if isin in watchlist["isin"]:
                print(f"✅ Verified: ISIN {isin} is in watchlist {watchlist_id}")
                return True
            else:
                print(f"❌ Verification failed: ISIN {isin} is NOT in watchlist {watchlist_id}")
                return False
    
    print(f"❌ Verification failed: Watchlist {watchlist_id} not found")
    return False

def verify_category_in_watchlist(watchlist_id, category, watchlists=None):
    """Verify if a category is set for a watchlist"""
    if watchlists is None:
        watchlists = get_watchlists()
    
    for watchlist in watchlists:
        if watchlist["_id"] == watchlist_id:
            if watchlist["category"] == category:
                print(f"✅ Verified: Category {category} is set for watchlist {watchlist_id}")
                return True
            else:
                print(f"❌ Verification failed: Category {category} is NOT set for watchlist {watchlist_id}")
                return False
    
    print(f"❌ Verification failed: Watchlist {watchlist_id} not found")
    return False

def run_tests():
    """Run all watchlist API tests"""
    print("\n============================================")
    print("Starting Watchlist API Tests")
    print("============================================")
    print(f"Test timestamp: {datetime.now().isoformat()}")
    
    test_results = {
        "register": False,
        "login": False,
        "create_watchlists": False,
        "add_isins": False,
        "set_categories": False,
        "get_watchlists": False,
        "remove_isins": False,
        "clear_watchlist": False,
        "delete_watchlist": False
    }
    
    # Step 1: Register a new user
    if not register_user():
        print("\n❌ User registration failed. Cannot proceed with tests.")
        return test_results
    
    test_results["register"] = True
    
    # Step 2: Login
    if not login_user():
        print("\n❌ User login failed. Cannot proceed with tests.")
        return test_results
    
    test_results["login"] = True
    
    # Step 3: Create multiple watchlists
    watchlist_ids = []
    watchlist_names = [
        "Tech Portfolio",
        "Financial Stocks",
        "Watchlist with a very long name that tests the limits of the system in terms of character length"
    ]
    
    for name in watchlist_names:
        watchlist_id = create_watchlist(name)
        if watchlist_id:
            watchlist_ids.append(watchlist_id)
    
    if len(watchlist_ids) != len(watchlist_names):
        print("\n❌ Failed to create all watchlists")
    else:
        print(f"\n✅ Successfully created {len(watchlist_ids)} watchlists")
        test_results["create_watchlists"] = True
    
    # Step 4: Add ISINs to each watchlist
    isins_added = 0
    for i, watchlist_id in enumerate(watchlist_ids):
        # Distribute ISINs among watchlists
        start_idx = i * 3
        end_idx = start_idx + 3
        if end_idx > len(TEST_ISINS):
            end_idx = len(TEST_ISINS)
        
        watchlist_isins = TEST_ISINS[start_idx:end_idx]
        
        for isin in watchlist_isins:
            if add_isin(watchlist_id, isin):
                isins_added += 1
    
    if isins_added > 0:
        print(f"\n✅ Successfully added {isins_added} ISINs across watchlists")
        test_results["add_isins"] = True
    else:
        print("\n❌ Failed to add any ISINs")
    
    # Step 5: Set category for each watchlist
    categories_set = 0
    for i, watchlist_id in enumerate(watchlist_ids):
        category = TEST_CATEGORIES[i % len(TEST_CATEGORIES)]
        # Adding an ISIN with category sets the category for the watchlist
        if add_isin(watchlist_id, None, category):
            categories_set += 1
    
    if categories_set > 0:
        print(f"\n✅ Successfully set {categories_set} categories")
        test_results["set_categories"] = True
    else:
        print("\n❌ Failed to set any categories")
    
    # Step 6: Get all watchlists and verify
    watchlists = get_watchlists()
    if watchlists:
        print(f"\n✅ Successfully retrieved {len(watchlists)} watchlists")
        test_results["get_watchlists"] = True
        
        # Verify ISINs and categories
        verification_passed = True
        
        # Verify ISINs in first watchlist
        if watchlist_ids and len(watchlist_ids) > 0:
            first_watchlist_id = watchlist_ids[0]
            test_isin = TEST_ISINS[0]
            if not verify_isin_in_watchlist(first_watchlist_id, test_isin, watchlists):
                verification_passed = False
        
        # Verify category in first watchlist
        if watchlist_ids and len(watchlist_ids) > 0:
            first_watchlist_id = watchlist_ids[0]
            test_category = TEST_CATEGORIES[0]
            if not verify_category_in_watchlist(first_watchlist_id, test_category, watchlists):
                verification_passed = False
        
        if not verification_passed:
            print("\n❌ Verification of watchlists data failed")
        
    else:
        print("\n❌ Failed to retrieve watchlists")
    
    # Step 7: Remove ISINs from watchlists
    if watchlist_ids and len(watchlist_ids) > 0 and len(TEST_ISINS) > 0:
        first_watchlist_id = watchlist_ids[0]
        test_isin = TEST_ISINS[0]
        
        if remove_isin(first_watchlist_id, test_isin):
            print(f"\n✅ Successfully removed ISIN {test_isin} from watchlist {first_watchlist_id}")
            test_results["remove_isins"] = True
            
            # Verify ISIN was removed
            watchlists = get_watchlists()
            for watchlist in watchlists:
                if watchlist["_id"] == first_watchlist_id:
                    if test_isin not in watchlist["isin"]:
                        print(f"✅ Verified: ISIN {test_isin} was removed from watchlist {first_watchlist_id}")
                    else:
                        print(f"❌ Verification failed: ISIN {test_isin} is still in watchlist {first_watchlist_id}")
        else:
            print(f"\n❌ Failed to remove ISIN {test_isin} from watchlist {first_watchlist_id}")
    
    # Step 8: Clear a watchlist
    if watchlist_ids and len(watchlist_ids) > 1:
        second_watchlist_id = watchlist_ids[1]
        
        if clear_watchlist(second_watchlist_id):
            print(f"\n✅ Successfully cleared watchlist {second_watchlist_id}")
            test_results["clear_watchlist"] = True
            
            # Verify watchlist was cleared
            watchlists = get_watchlists()
            for watchlist in watchlists:
                if watchlist["_id"] == second_watchlist_id:
                    if not watchlist["isin"]:
                        print(f"✅ Verified: Watchlist {second_watchlist_id} was cleared")
                    else:
                        print(f"❌ Verification failed: Watchlist {second_watchlist_id} still has ISINs")
        else:
            print(f"\n❌ Failed to clear watchlist {second_watchlist_id}")
    
    # Step 9: Delete a watchlist
    if watchlist_ids and len(watchlist_ids) > 2:
        third_watchlist_id = watchlist_ids[2]
        
        if delete_watchlist(third_watchlist_id):
            print(f"\n✅ Successfully deleted watchlist {third_watchlist_id}")
            test_results["delete_watchlist"] = True
            
            # Verify watchlist was deleted
            watchlists = get_watchlists()
            found = False
            for watchlist in watchlists:
                if watchlist["_id"] == third_watchlist_id:
                    found = True
                    break
            
            if not found:
                print(f"✅ Verified: Watchlist {third_watchlist_id} was deleted")
            else:
                print(f"❌ Verification failed: Watchlist {third_watchlist_id} still exists")
        else:
            print(f"\n❌ Failed to delete watchlist {third_watchlist_id}")
    
    # Summary
    print("\n============================================")
    print("Watchlist API Tests Summary")
    print("============================================")
    
    success_count = sum(1 for result in test_results.values() if result)
    total_count = len(test_results)
    success_rate = (success_count / total_count) * 100
    
    for test, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test.replace('_', ' ').title()}: {status}")
    
    print("\n============================================")
    print(f"Overall Success Rate: {success_rate:.2f}% ({success_count}/{total_count})")
    print("============================================")
    
    return test_results

if __name__ == "__main__":
    try:
        results = run_tests()
        
        # Exit with appropriate status code
        success_count = sum(1 for result in results.values() if result)
        if success_count == len(results):
            print("\nAll tests passed successfully!")
            sys.exit(0)
        else:
            print(f"\n{len(results) - success_count} tests failed!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        sys.exit(1)