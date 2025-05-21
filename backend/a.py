from supabase import create_client, Client
from dotenv import load_dotenv 
import os
import json

load_dotenv()
supabase_url: str = os.getenv("SUPABASE_URL2")
supabase_key: str = os.getenv("SUPABASE_KEY2")

supabase: Client = create_client(supabase_url, supabase_key)

def get_watchlist_by_user(user_id):
    """
    Fetch the watchlist for a given user from the database.
    
    Args:
        user_id (str): The ID of the user whose watchlist is to be fetched.
    
    Returns:
        list: A list of movies in the user's watchlist.
    """
    try:
        response = supabase.table('watchlistdata').select("*").eq("userid", user_id).execute()
        if response.data:
            return response.data
        else:
            print(f"Error fetching watchlist: {response.error}")
            return []
    except Exception as e:
        print(f"An error occurred: {e}")
        return []

def get_watchlist_by_isin(isin):
    """
    Fetch the watchlist for a given ISIN from the database.
    
    Args:
        isin (str): The ISIN of the movie whose watchlist is to be fetched.
    
    Returns:
        list: A list of movies in the user's watchlist.
    """
    try:
        response = supabase.table('watchlistdata').select("*").eq("isin", isin).execute()
        if response.data:
            return response.data
        else:
            print(f"Error fetching watchlist: {response.error}")
            return []
    except Exception as e:
        print(f"An error occurred: {e}")
        return []
    
def get_watchlist_by_watchlist_id(watchlist_id):
    """
    Fetch the watchlist for a given watchlist ID from the database.
    
    Args:
        watchlist_id (str): The ID of the watchlist to be fetched.
    
    Returns:
        list: A list of movies in the user's watchlist.
    """
    try:
        response = supabase.table('watchlistdata').select("*").eq("watchlistid", watchlist_id).execute()
        if response.data:
            return response.data
        else:
            print(f"Error fetching watchlist: {response.error}")
            return []
    except Exception as e:
        print(f"An error occurred: {e}")
        return []

def get_watchlist_by_category(category):
    """
    Fetch the watchlist for a given category from the database.
    
    Args:
        category (str): The category of the movie whose watchlist is to be fetched.
    
    Returns:
        list: A list of movies in the user's watchlist.
    """
    try:
        response = supabase.table('watchlistdata').select("*").eq("category", category).execute()
        if response.data:
            return response.data
        else:
            print(f"Error fetching watchlist: {response.error}")
            return []
    except Exception as e:
        print(f"An error occurred: {e}")
        return []
    
def get_users_by_isin(isin):
    """Get users by ISIN from the database."""
    try:
        response = supabase.table('watchlistdata').select('userid').eq('isin', isin).execute()
        if response.data:
            return [user['userid'] for user in response.data]
        else:
            return []
    except Exception as e:
        return []

def get_stockprices(isin):
    response = supabase.table('stockpricedata').select('close','date').eq('isin', isin).order('date', desc=True).execute()
    st = response.data
    return st

a = get_stockprices("INE406A01037")
print(json.dumps(a, indent=4))