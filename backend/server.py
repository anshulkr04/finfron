#!/usr/bin/env python3
from flask import Flask, request, jsonify
import os
from gevent import monkey
monkey.patch_all()
import sys
from functools import wraps
from flask_cors import CORS
from dotenv import load_dotenv
import datetime
import uuid
import logging
import hashlib
import secrets
import json
import threading
import importlib.util
from pathlib import Path
from flask_socketio import SocketIO, emit
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('finBack')

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Configure CORS to be completely permissive
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": "*"}}, supports_credentials=True)

# Initialize Socket.IO with the Flask app
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# Configuration options with environment variables
DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() == 'true'
PORT = int(os.getenv('PORT', 5001))

# Set higher log level if debug mode is enabled
if DEBUG_MODE:
    logger.setLevel(logging.DEBUG)
    logger.debug("Debug logging enabled")

# Initialize both Supabase clients
supabase = None
supabase_connected = False
supabase2 = None  # For BSE scraper
supabase2_connected = False

try:
    from supabase import create_client, Client
    
    # Initialize primary Supabase client
    supabase_url = os.getenv('SUPABASE_URL2')
    supabase_key = os.getenv('SUPABASE_KEY2')
    
    if not supabase_url or not supabase_key:
        logger.error("Primary Supabase credentials are missing! Primary data operations will fail.")
    else:
        logger.info(f"Initializing primary Supabase client with URL: {supabase_url[:20]}...")
        supabase = create_client(supabase_url, supabase_key)
        supabase_connected = True
        logger.info("Primary Supabase client initialized successfully")
    
    # Initialize secondary Supabase client if credentials provided
    supabase_url2 = os.getenv('SUPABASE_URL2')
    supabase_key2 = os.getenv('SUPABASE_KEY2')
    
    if supabase_url2 and supabase_key2:
        logger.info(f"Initializing secondary Supabase client with URL: {supabase_url2[:20]}...")
        supabase2 = create_client(supabase_url2, supabase_key2)
        supabase2_connected = True
        logger.info("Secondary Supabase client initialized successfully")
    else:
        logger.warning("Secondary Supabase credentials not provided. BSE scraper functionality will be limited.")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client(s): {str(e)}")
    logger.error("The application will not function correctly without Supabase.")

# Helper functions for custom auth
def hash_password(password):
    """Hash a password for storing."""
    salt = os.getenv('PASSWORD_SALT', 'default_salt_change_this_in_production')
    return hashlib.sha256((password + salt).encode()).hexdigest()

def verify_password(stored_password, provided_password):
    """Verify a stored password against a provided password."""
    return stored_password == hash_password(provided_password)

def generate_access_token():
    """Generate a secure random access token."""
    return secrets.token_hex(32)  # 64 character hex string

# Custom authentication middleware
def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Handle OPTIONS requests first
        if request.method == 'OPTIONS':
            return _handle_options()
            
        token = None
        
        # Check if token is in the request headers
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Authentication token is missing!'}), 401
        
        if not supabase_connected:
            return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
        
        try:
            # Find user with matching access token
            if token.startswith('eq.'):
                clean_token = token
            else:
                clean_token = token
            response = supabase.table('UserData').select('*').eq('AccessToken', clean_token).execute()

            if not response.data or len(response.data) == 0:
                return jsonify({'message': 'Invalid authentication token!'}), 401
                
            # User found with matching token
            current_user = response.data[0]
            
            # Check if token is expired (optional - implement if needed)
            # You could add token_expiry field to UserData table
            
            return f(current_user, *args, **kwargs)
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'message': f'Authentication failed: {str(e)}'}), 401
    
    return decorated

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connections"""
    logger.info(f"Client connected: {request.sid}")
    emit('status', {'message': 'Connected to Financial Backend API'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnections"""
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('join')
def handle_join(data):
    """Handle client joining a specific room (e.g., for specific ISINs or companies)"""
    # Clients can join rooms to get specific notifications
    if 'room' in data:
        room = data['room']
        logger.info(f"Client {request.sid} joined room: {room}")
        socketio.server.enter_room(request.sid, room)
        emit('status', {'message': f'Joined room: {room}'}, room=request.sid)

@socketio.on('leave')
def handle_leave(data):
    """Handle client leaving a specific room"""
    if 'room' in data:
        room = data['room']
        logger.info(f"Client {request.sid} left room: {room}")
        socketio.server.leave_room(request.sid, room)
        emit('status', {'message': f'Left room: {room}'}, room=request.sid)

# A simple health check endpoint
@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    """Simple health check endpoint"""
    if request.method == 'OPTIONS':
        return _handle_options()
    
    response = {
        "status": "ok",
        "timestamp": datetime.datetime.now().isoformat(),
        "server": "Financial Backend API (Custom Auth)",
        "supabase_connected": supabase_connected,
        "supabase2_connected": supabase2_connected,
        "debug_mode": DEBUG_MODE,
        "environment": {
            "supabase_url_set": bool(os.getenv('SUPABASE_URL2')),
            "supabase_key_set": bool(os.getenv('SUPABASE_KEY2')),
            "supabase_url2_set": bool(os.getenv('SUPABASE_URL2')),
            "supabase_key2_set": bool(os.getenv('SUPABASE_KEY2')),
        }
    }
    return jsonify(response), 200

# Also add a health check at the API path
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def api_health_check():
    """API health check endpoint"""
    return health_check()

# Function to handle OPTIONS requests
def _handle_options():
    response = app.make_default_options_response()
    headers = response.headers
    
    # Set CORS headers
    headers["Access-Control-Allow-Origin"] = "*"
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    headers["Access-Control-Max-Age"] = "3600"  # Cache preflight response for 1 hour
    
    return response

# Handle OPTIONS requests for all routes
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return _handle_options()

# Routes
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    if request.method == 'OPTIONS':
        return _handle_options()
        
    data = request.get_json()
    
    # Check if required fields exist
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields!'}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    logger.info(f"Registration attempt for email: {email}")
    
    if not supabase_connected:
        return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
    
    try:
        # Check if email already exists
        check_response = supabase.table('UserData').select('emailID').eq('emailID', email).execute()
        
        if check_response.data and len(check_response.data) > 0:
            return jsonify({'message': 'Email already registered. Please use a different email or try logging in.'}), 409
        
        # Generate new UUID for user
        user_id = str(uuid.uuid4())
        
        # Generate access token
        access_token = generate_access_token()
        
        # Hash the password
        hashed_password = hash_password(password)
        
        # Create initial watchlist
        watchlist = [{
            "_id": str(uuid.uuid4()),
            "watchlistName": "My Watchlist",
            "isin": []
        }]
        
        # Create user data
        user_data = {
            'UserID': user_id,
            'emailID': email,
            'Password': hashed_password,
            'Phone_Number': data.get('phone', None),
            'Paid': 'false',
            'AccountType': data.get('account_type', 'free'),
            'created_at': datetime.datetime.now().isoformat(),
            'AccessToken': access_token,
            'WatchListID': watchlist
        }
        
        # Insert user into UserData table
        supabase.table('UserData').insert(user_data).execute()
        
        logger.info(f"User registered successfully: {user_id}")
        
        # Return success with token
        return jsonify({
            'message': 'User registered successfully!',
            'user_id': user_id,
            'token': access_token
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'message': f'Registration failed: {str(e)}'}), 500

@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return _handle_options()
        
    data = request.get_json()
    
    # Check if required fields exist
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing required fields!'}), 400
    
    email = data.get('email')
    password = data.get('password')
    
    logger.info(f"Login attempt for email: {email}")
    
    if not supabase_connected:
        return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
    
    try:
        # Find user by email
        response = supabase.table('UserData').select('*').eq('emailID', email).execute()
        
        if not response.data or len(response.data) == 0:
            return jsonify({'message': 'Invalid email or password.'}), 401
            
        user = response.data[0]
        
        # Verify password
        if not verify_password(user['Password'], password):
            return jsonify({'message': 'Invalid email or password.'}), 401
            
        # Generate new access token
        access_token = generate_access_token()
        
        # Update access token in database
        supabase.table('UserData').update({'AccessToken': access_token}).eq('UserID', user['UserID']).execute()
        
        logger.info(f"User logged in successfully: {user['UserID']}")
        
        # Return success with token
        return jsonify({
            'message': 'Login successful!',
            'user_id': user['UserID'],
            'token': access_token
        }), 200
        
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'message': f'Login failed: {str(e)}'}), 500

@app.route('/api/logout', methods=['POST', 'OPTIONS'])
@auth_required
def logout(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
    
    user_id = current_user['UserID']
    logger.info(f"Logout attempt for user: {user_id}")
    
    if not supabase_connected:
        return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
        
    try:
        # Invalidate the token by setting it to null or empty
        supabase.table('UserData').update({'AccessToken': None}).eq('UserID', user_id).execute()
        
        logger.info(f"User logged out successfully: {user_id}")
        return jsonify({'message': 'Logged out successfully!'}), 200
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({'message': f'Logout failed: {str(e)}'}), 500

@app.route('/api/user', methods=['GET', 'OPTIONS'])
@auth_required
def get_user(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
    
    # The current_user is already loaded from the middleware
    user_id = current_user['UserID']
    logger.debug(f"Get user profile for user: {user_id}")
    
    # Remove sensitive information
    user_data = {k: v for k, v in current_user.items() if k.lower() not in ['password', 'accesstoken']}
    return jsonify(user_data), 200

@app.route('/api/update_user', methods=['PUT', 'OPTIONS'])
@auth_required
def update_user(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
        
    data = request.get_json()
    user_id = current_user['UserID']
    logger.info(f"Update user profile for user: {user_id}")
    
    # Remove fields that shouldn't be updated directly
    safe_data = {k: v for k, v in data.items() if k.lower() not in ['userid', 'accesstoken', 'password', 'email', 'emailid']}
    
    # Handle password change separately if provided
    if 'new_password' in data and data.get('current_password'):
        # Verify current password
        if not verify_password(current_user['Password'], data.get('current_password')):
            return jsonify({'message': 'Current password is incorrect.'}), 401
            
        # Update with new hashed password
        safe_data['Password'] = hash_password(data.get('new_password'))
    
    if not supabase_connected:
        return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
    
    try:
        # Update user data in UserData table
        supabase.table('UserData').update(safe_data).eq('UserID', user_id).execute()
        logger.debug(f"User data updated successfully: {user_id}")
        return jsonify({'message': 'User data updated successfully!'}), 200
    except Exception as e:
        logger.error(f"User update error: {str(e)}")
        return jsonify({'message': f'Update failed: {str(e)}'}), 500

@app.route('/api/upgrade_account', methods=['POST', 'OPTIONS'])
@auth_required
def upgrade_account(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
        
    data = request.get_json()
    user_id = current_user['UserID']
    account_type = data.get('account_type', 'premium')
    logger.info(f"Upgrade account for user: {user_id} to {account_type}")
    
    if not supabase_connected:
        return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
    
    try:
        # Update account type and payment status
        update_data = {
            'Paid': 'true',
            'AccountType': account_type,
            'PaidTime': datetime.datetime.now().isoformat()
        }
        
        supabase.table('UserData').update(update_data).eq('UserID', user_id).execute()
        logger.debug(f"Account upgraded successfully: {user_id}")
        return jsonify({'message': 'Account upgraded successfully!'}), 200
    except Exception as e:
        logger.error(f"Account upgrade error: {str(e)}")
        return jsonify({'message': f'Upgrade failed: {str(e)}'}), 500

# Enhanced Watchlist APIs
@app.route('/api/watchlist', methods=['GET', 'OPTIONS'])
@auth_required
def get_watchlist(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
    
    user_id = current_user['UserID']
    logger.debug(f"Get watchlist for user: {user_id}")
    
    try:
        watchlists = current_user.get('WatchListID', [])

        # If no watchlists exist, initialize with an empty array
        if watchlists is None or not isinstance(watchlists, list):
            # Check if it's the old format (single watchlist)
            if isinstance(watchlists, dict) and '_id' in watchlists:
                # Convert old format to new format
                watchlists = [watchlists]
            else:
                watchlists = [{
                    "_id": str(uuid.uuid4()),
                    "watchlistName": "My Watchlist",
                    "isin": []
                }]

            if not supabase_connected:
                return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

            supabase.table('UserData').update({'WatchListID': watchlists}).eq('UserID', user_id).execute()

        # Validate structure of each watchlist
        for watchlist in watchlists:
            if 'isin' not in watchlist or not isinstance(watchlist['isin'], list):
                watchlist['isin'] = []
            if 'watchlistName' not in watchlist:
                watchlist['watchlistName'] = "My Watchlist"
            if '_id' not in watchlist:
                watchlist['_id'] = str(uuid.uuid4())

        return jsonify({'watchlists': watchlists}), 200

    except Exception as e:
        logger.error(f"Get watchlist error: {str(e)}")
        return jsonify({'message': f'Failed to retrieve watchlist: {str(e)}'}), 500

@app.route('/api/watchlist', methods=['POST', 'OPTIONS'])
@auth_required
def manage_watchlist(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
    
    data = request.get_json() or {}
    user_id = current_user['UserID']
    
    # Determine operation type
    operation = data.get('operation', '')
    
    if operation == 'create':
        # Create a new watchlist
        logger.info(f"Create watchlist for user: {user_id}")
        try:
            new_watchlist = {
                "_id": str(uuid.uuid4()),
                "watchlistName": data.get('watchlistName', 'My Watchlist'),
                "isin": []
            }

            watchlists = current_user.get('WatchListID', [])
            
            # Handle conversion from old format
            if watchlists is None:
                watchlists = []
            elif isinstance(watchlists, dict) and '_id' in watchlists:
                # Convert old format to new format
                watchlists = [watchlists]
            elif not isinstance(watchlists, list):
                watchlists = []
            
            watchlists.append(new_watchlist)

            if not supabase_connected:
                return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

            supabase.table('UserData').update({'WatchListID': watchlists}).eq('UserID', user_id).execute()

            logger.debug(f"Watchlist created successfully for user: {user_id}")
            return jsonify({'watchlist': new_watchlist, 'watchlists': watchlists}), 201
        except Exception as e:
            logger.error(f"Create watchlist error: {str(e)}")
            return jsonify({'message': f'Failed to create watchlist: {str(e)}'}), 500
            
    elif operation == 'add_isin':
        # Add an ISIN to a specific watchlist
        logger.info(f"Add to watchlist for user: {user_id}")
        
        watchlist_id = data.get('watchlist_id')
        isin = data.get('isin')
        
        if not isin:
            return jsonify({'message': 'Missing required fields! isin is required.'}), 400

        if not isinstance(isin, str) or len(isin) != 12 or not isin.isalnum():
            return jsonify({'message': 'Invalid ISIN format! ISIN must be a 12-character alphanumeric code.'}), 400
            
        if not watchlist_id:
            return jsonify({'message': 'Missing required fields! watchlist_id is required.'}), 400
            
        try:
            watchlists = current_user.get('WatchListID', [])
            
            # Handle conversion from old format
            if watchlists is None:
                watchlists = []
            elif isinstance(watchlists, dict) and '_id' in watchlists:
                # Convert old format to new format
                watchlists = [watchlists]
            elif not isinstance(watchlists, list):
                watchlists = []
                
            # Find the specific watchlist
            target_watchlist = None
            for watchlist in watchlists:
                if watchlist.get('_id') == watchlist_id:
                    target_watchlist = watchlist
                    break
                    
            if not target_watchlist:
                return jsonify({'message': 'Watchlist not found!'}), 404
                
            if 'isin' not in target_watchlist or not isinstance(target_watchlist['isin'], list):
                target_watchlist['isin'] = []
                
            if isin in target_watchlist['isin']:
                return jsonify({'message': 'ISIN already in watchlist!'}), 409
                
            target_watchlist['isin'].append(isin)
            
            if not supabase_connected:
                return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
                
            supabase.table('UserData').update({'WatchListID': watchlists}).eq('UserID', user_id).execute()
            
            logger.debug(f"ISIN {isin} added to watchlist {watchlist_id} for user: {user_id}")
            return jsonify({
                'message': 'ISIN added to watchlist!',
                'watchlist': target_watchlist,
                'watchlists': watchlists
            }), 201
        except Exception as e:
            logger.error(f"Add to watchlist error: {str(e)}")
            return jsonify({'message': f'Failed to add ISIN to watchlist: {str(e)}'}), 500
    else:
        return jsonify({'message': 'Invalid operation! Use "create" or "add_isin".'}), 400

@app.route('/api/watchlist/<watchlist_id>/isin/<isin>', methods=['DELETE', 'OPTIONS'])
@auth_required
def remove_from_watchlist(current_user, watchlist_id, isin):
    if request.method == 'OPTIONS':
        return _handle_options()

    user_id = current_user['UserID']
    logger.info(f"Remove ISIN {isin} from watchlist {watchlist_id} for user: {user_id}")

    try:
        watchlists = current_user.get('WatchListID', [])

        # Handle conversion from old format
        if watchlists is None:
            return jsonify({'message': 'No watchlists found!'}), 404
        elif isinstance(watchlists, dict) and '_id' in watchlists:
            # Convert old format to new format
            watchlists = [watchlists]
        elif not isinstance(watchlists, list) or not watchlists:
            return jsonify({'message': 'No watchlists found!'}), 404

        # Find the target watchlist
        target_watchlist = None
        for watchlist in watchlists:
            if watchlist.get('_id') == watchlist_id:
                target_watchlist = watchlist
                break
                
        if not target_watchlist:
            return jsonify({'message': 'Watchlist not found!'}), 404
            
        if 'isin' not in target_watchlist or not isinstance(target_watchlist['isin'], list):
            return jsonify({'message': 'Watchlist is empty!'}), 404

        if isin not in target_watchlist['isin']:
            return jsonify({'message': 'ISIN not found in watchlist!'}), 404

        target_watchlist['isin'].remove(isin)

        if not supabase_connected:
            return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

        supabase.table('UserData').update({'WatchListID': watchlists}).eq('UserID', user_id).execute()

        logger.debug(f"ISIN {isin} removed from watchlist for user: {user_id}")
        return jsonify({
            'message': 'ISIN removed from watchlist!',
            'watchlist': target_watchlist,
            'watchlists': watchlists
        }), 200
    except Exception as e:
        logger.error(f"Remove from watchlist error: {str(e)}")
        return jsonify({'message': f'Failed to remove ISIN from watchlist: {str(e)}'}), 500

@app.route('/api/watchlist/<watchlist_id>', methods=['DELETE', 'OPTIONS'])
@auth_required
def delete_watchlist(current_user, watchlist_id):
    if request.method == 'OPTIONS':
        return _handle_options()

    user_id = current_user['UserID']
    logger.info(f"Delete watchlist {watchlist_id} for user: {user_id}")

    try:
        watchlists = current_user.get('WatchListID', [])

        # Handle conversion from old format
        if watchlists is None:
            return jsonify({'message': 'No watchlists found!'}), 404
        elif isinstance(watchlists, dict) and '_id' in watchlists:
            # If it's the only watchlist, don't allow deleting
            return jsonify({'message': 'Cannot delete the only watchlist!'}), 400
        elif not isinstance(watchlists, list) or not watchlists:
            return jsonify({'message': 'No watchlists found!'}), 404

        # Find and remove the watchlist
        watchlist_found = False
        updated_watchlists = []
        for watchlist in watchlists:
            if watchlist.get('_id') != watchlist_id:
                updated_watchlists.append(watchlist)
            else:
                watchlist_found = True
                
        if not watchlist_found:
            return jsonify({'message': 'Watchlist not found!'}), 404

        # Ensure there's at least one watchlist
        if not updated_watchlists:
            updated_watchlists = [{
                "_id": str(uuid.uuid4()),
                "watchlistName": "My Watchlist",
                "isin": []
            }]

        if not supabase_connected:
            return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

        supabase.table('UserData').update({'WatchListID': updated_watchlists}).eq('UserID', user_id).execute()

        logger.debug(f"Watchlist {watchlist_id} deleted for user: {user_id}")
        return jsonify({
            'message': 'Watchlist deleted successfully!',
            'watchlists': updated_watchlists
        }), 200
    except Exception as e:
        logger.error(f"Delete watchlist error: {str(e)}")
        return jsonify({'message': f'Failed to delete watchlist: {str(e)}'}), 500

@app.route('/api/watchlist/<watchlist_id>/clear', methods=['POST', 'OPTIONS'])
@auth_required
def clear_watchlist(current_user, watchlist_id):
    if request.method == 'OPTIONS':
        return _handle_options()

    user_id = current_user['UserID']
    logger.info(f"Clear watchlist {watchlist_id} for user: {user_id}")

    try:
        watchlists = current_user.get('WatchListID', [])

        # Handle conversion from old format
        if watchlists is None:
            return jsonify({'message': 'No watchlists found!'}), 404
        elif isinstance(watchlists, dict) and '_id' in watchlists:
            if watchlists.get('_id') == watchlist_id:
                watchlists['isin'] = []
                target_watchlist = watchlists
                watchlists = [watchlists]  # Convert to new format
            else:
                return jsonify({'message': 'Watchlist not found!'}), 404
        elif not isinstance(watchlists, list) or not watchlists:
            return jsonify({'message': 'No watchlists found!'}), 404
        else:
            # Find the target watchlist
            target_watchlist = None
            for watchlist in watchlists:
                if watchlist.get('_id') == watchlist_id:
                    target_watchlist = watchlist
                    break
                    
            if not target_watchlist:
                return jsonify({'message': 'Watchlist not found!'}), 404
                
            # Clear the ISINs
            target_watchlist['isin'] = []

        if not supabase_connected:
            return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

        supabase.table('UserData').update({'WatchListID': watchlists}).eq('UserID', user_id).execute()

        logger.debug(f"Watchlist {watchlist_id} cleared for user: {user_id}")
        return jsonify({
            'message': 'Watchlist cleared successfully!',
            'watchlist': target_watchlist,
            'watchlists': watchlists
        }), 200
    except Exception as e:
        logger.error(f"Clear watchlist error: {str(e)}")
        return jsonify({'message': f'Failed to clear watchlist: {str(e)}'}), 500
    
@app.route('/api/corporate_filings', methods=['GET', 'OPTIONS'])
def get_corporate_filings():
    if request.method == 'OPTIONS':
        return _handle_options()

    try:
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        category = request.args.get('category')
        symbol = request.args.get('symbol')
        isin = request.args.get('isin')

        if not supabase_connected:
            return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

        # Use original client and table
        query = supabase.table('CorporateFilings').select('*').order('created_at', desc=True)

        # Date filters
        if start_date:
            try:
                # Parse user input (YYYY-MM-DD)
                start_dt = datetime.datetime.strptime(start_date, '%Y-%m-%d')
                # Convert to format matching the database (DD-MMM-YYYY HH:MM:SS)
                start_date_str = start_dt.strftime('%d-%b-%Y %H:%M:%S')
                query = query.gte('created_at', start_date_str)
            except ValueError:
                return jsonify({'message': 'Invalid start_date format. Use YYYY-MM-DD'}), 400

        if end_date:
            try:
                # Parse user input (YYYY-MM-DD) and set to end of day
                end_dt = datetime.datetime.strptime(end_date, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
                # Convert to format matching the database (DD-MMM-YYYY HH:MM:SS)
                end_date_str = end_dt.strftime('%d-%b-%Y %H:%M:%S')
                query = query.lte('created_at', end_date_str)
            except ValueError:
                return jsonify({'message': 'Invalid end_date format. Use YYYY-MM-DD'}), 400

        # Apply other filters
        if category:
            query = query.eq('Category', category)
        if symbol:
            query = query.eq('Symbol', symbol)
        if isin:
            query = query.eq('ISIN', isin)

        # Execute query
        response = query.execute()

        # Check for errors
        if hasattr(response, 'error') and response.error:
            return jsonify({'message': f'Error retrieving corporate filings: {response.error.message}'}), 500

        return jsonify({
            'count': len(response.data),
            'filings': response.data  # Return all filings, not just 5
        }), 200

    except Exception as e:
        logger.error(f"Get corporate filings error: {str(e)}")
        return jsonify({'message': f'Failed to retrieve corporate filings: {str(e)}'}), 500

@app.route('/insert_new_announcement', methods=['POST', 'OPTIONS'])
def insert_new_announcement():
    """Endpoint to receive new announcements from the scraper for websocket streaming"""
    if request.method == 'OPTIONS':
        return _handle_options()
        
    data = request.get_json()
    
    if not data:
        return jsonify({'message': 'Missing data!'}), 400
    
    logger.info(f"Received new announcement data: {data.get('summary', '')}")
    
    # Broadcast to all connected clients
    socketio.emit('new_announcement', data)
    
    # If the announcement has an ISIN, also broadcast to that specific room
    if 'isin' in data and data['isin']:
        socketio.emit('new_announcement', data, room=data['isin'])
        
    # Also broadcast to symbol room if available
    if 'symbol' in data and data['symbol']:
        socketio.emit('new_announcement', data, room=data['symbol'])
    
    return jsonify({'message': 'Announcement received and broadcasted successfully!'}), 200

@app.route('/api/company/search', methods=['GET', 'OPTIONS'])
def search_companies():
    if request.method == 'OPTIONS':
        return _handle_options()
        
    try:
        # Get search parameters
        query = request.args.get('q', '').strip()
        limit = request.args.get('limit')
        
        # Validate and convert limit to integer if provided
        if limit:
            try:
                limit = int(limit)
                if limit < 1:
                    return jsonify({'message': 'Limit must be a positive integer'}), 400
            except ValueError:
                return jsonify({'message': 'Limit must be a valid integer'}), 400
        
        # If no search query is provided, return an error
        if not query:
            return jsonify({'message': 'Search query is required (use parameter q)'}), 400
        
        logger.debug(f"Search companies: query={query}, limit={limit}")
        
        if not supabase_connected:
            return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
            
        # Initialize the Supabase query with the original table and uppercase column names
        supabase_query = supabase.table('nse_bse_codes').select('*')
        
        # Apply search filters (case-insensitive)
        search_pattern = f"%{query}%"
        
        # Build the query with proper OR conditions
        or_filter = (
            f"NewName.ilike.{search_pattern},"
            f"OldName.ilike.{search_pattern},"
            f"NewNSEcode.ilike.{search_pattern},"
            f"OldNSEcode.ilike.{search_pattern},"
            f"NewBSEcode.ilike.{search_pattern},"
            f"OldBSEcode.ilike.{search_pattern},"
            f"ISIN.ilike.{search_pattern}"
        )
        filter_query = supabase_query.or_(or_filter)
        
        # Apply limit if provided
        if limit:
            filter_query = filter_query.limit(limit)
        
        # Execute the query
        response = filter_query.execute()
        
        # Check if response was successful
        if hasattr(response, 'error') and response.error is not None:
            return jsonify({'message': f'Error searching companies: {response.error.message}'}), 500
        
        # Return the search results
        return jsonify({
            'count': len(response.data),
            'companies': response.data
        }), 200
        
    except Exception as e:
        logger.error(f"Search companies error: {str(e)}")
        return jsonify({'message': f'Failed to search companies: {str(e)}'}), 500

# Function to start the BSE scraper
def start_scraper():
    """Start the BSE scraper in a separate thread with better error handling"""
    try:
        logger.info("Starting BSE scraper in background thread...")
        
        # Get the path to the bse_scraper.py file
        scraper_path = Path(__file__).parent / "bse_scraper.py"
        
        if not scraper_path.exists():
            logger.error(f"Scraper file not found at: {scraper_path}")
            return
            
        # Import the scraper module dynamically
        spec = importlib.util.spec_from_file_location("bse_scraper", scraper_path)
        scraper_module = importlib.util.module_from_spec(spec)
        sys.modules["bse_scraper"] = scraper_module
        spec.loader.exec_module(scraper_module)
        
        # Create and run the scraper
        today = datetime.datetime.today().strftime('%Y%m%d')
        
        try:
            # Initialize scraper
            scraper = scraper_module.BseScraper(today, today)
            
            # Run in polling mode
            logger.info("BSE scraper initialized, running in polling mode")
            
            # First run - execute immediately
            try:
                scraper.run()  # Just run once
                logger.info("Initial scraper run completed")
            except Exception as e:
                logger.error(f"Error in initial scraper run: {str(e)}")
            
            # Then poll periodically
            check_interval = 10  # seconds
            while True:
                try:
                    # Wait for next check interval
                    time.sleep(check_interval)
                    
                    # Update date to current date
                    current_day = datetime.datetime.today().strftime('%Y%m%d')
                    logger.debug(f"Running scheduled scraper check for date: {current_day}")
                    
                    # Create a new scraper instance each time to avoid state issues
                    scraper = scraper_module.BseScraper(current_day, current_day)
                    scraper.run()
                    
                except Exception as e:
                    logger.error(f"Error in periodic scraper run: {str(e)}")
                    # Continue the loop even after errors
            
        except Exception as e:
            logger.error(f"Error creating scraper instance: {str(e)}")
            
    except Exception as e:
        logger.error(f"Error importing scraper module: {str(e)}")

if __name__ == '__main__':
    # Print environment status
    logger.info(f"Starting Financial Backend API (Custom Auth) on port {PORT}")
    logger.info(f"Debug Mode: {'ENABLED' if DEBUG_MODE else 'DISABLED'}")
    logger.info(f"Primary Supabase: {'Connected' if supabase_connected else 'NOT CONNECTED'}")
    logger.info(f"Secondary Supabase: {'Connected' if supabase2_connected else 'NOT CONNECTED'}")
    
    # Debug mode helps with development but should be disabled in production
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    logger.info(f"Flask Debug Mode: {'ENABLED' if debug_mode else 'DISABLED'}")
    logger.info(f"Health endpoint: http://localhost:{PORT}/health")
    logger.info(f"API health endpoint: http://localhost:{PORT}/api/health")
    logger.info(f"WebSocket server enabled on port {PORT}")
    
    # Start the scraper in a separate thread if secondary Supabase is connected
    if supabase2_connected:
        logger.info("Starting scraper thread...")
        scraper_thread = threading.Thread(target=start_scraper, daemon=True)
        scraper_thread.start()
        logger.info("Scraper thread started")
    else:
        logger.warning("BSE scraper disabled - secondary Supabase not connected")
    
    # Run the application with Socket.IO instead of the standard Flask server
    socketio.run(app, debug=debug_mode, host='0.0.0.0', port=PORT, allow_unsafe_werkzeug=True)