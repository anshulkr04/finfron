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
import traceback

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
CORS(app, resources={
    r"/*": {
        "origins": "*", 
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        "allow_headers": "*"
    }
}, supports_credentials=True)
# Initialize Socket.IO with the Flask app
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode='gevent',
    ping_timeout=60,  # Increase ping timeout
    ping_interval=25,  # Decrease ping interval
    logger=True,       # Enable logging
    engineio_logger=True
)

# Improved Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connections with improved logging"""
    client_id = request.sid
    ip = request.remote_addr if hasattr(request, 'remote_addr') else 'unknown'
    logger.info(f"Client connected: {client_id} from {ip}")
    
    # Send welcome message
    emit('status', {'message': 'Connected to Financial Backend API', 'connected': True})
    
    # Automatically join the 'all' room to receive general announcements
    socketio.server.enter_room(client_id, 'all')
    logger.info(f"Client {client_id} automatically joined room: all")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnections with improved logging"""
    client_id = request.sid
    logger.info(f"Client disconnected: {client_id}")

@socketio.on('error')
def handle_error(error):
    """Handle WebSocket errors"""
    client_id = request.sid
    logger.error(f"Socket error for client {client_id}: {error}")
    emit('status', {'message': 'Error occurred', 'error': True}, room=client_id)

@socketio.on('join')
def handle_join(data):
    """Handle client joining a specific room with improved validation"""
    client_id = request.sid
    
    # Validate room parameter
    if not isinstance(data, dict) or 'room' not in data:
        logger.warning(f"Invalid join request from {client_id}: missing 'room' parameter")
        emit('status', {'message': 'Invalid request: missing room parameter', 'error': True}, room=client_id)
        return
        
    room = data['room']
    
    # Validate room name
    if not room or not isinstance(room, str):
        logger.warning(f"Invalid join request from {client_id}: invalid room name")
        emit('status', {'message': 'Invalid request: invalid room name', 'error': True}, room=client_id)
        return
        
    # Sanitize room name (prevent injection)
    room = room.strip()[:50]  # Limit length and strip whitespace
    
    logger.info(f"Client {client_id} joined room: {room}")
    socketio.server.enter_room(client_id, room)
    emit('status', {'message': f'Joined room: {room}'}, room=client_id)

@socketio.on('leave')
def handle_leave(data):
    """Handle client leaving a specific room with improved validation"""
    client_id = request.sid
    
    # Validate room parameter
    if not isinstance(data, dict) or 'room' not in data:
        logger.warning(f"Invalid leave request from {client_id}: missing 'room' parameter")
        emit('status', {'message': 'Invalid request: missing room parameter', 'error': True}, room=client_id)
        return
        
    room = data['room']
    
    # Validate room name
    if not room or not isinstance(room, str):
        logger.warning(f"Invalid leave request from {client_id}: invalid room name")
        emit('status', {'message': 'Invalid request: invalid room name', 'error': True}, room=client_id)
        return
        
    # Sanitize room name
    room = room.strip()[:50]
    
    logger.info(f"Client {client_id} left room: {room}")
    socketio.server.leave_room(client_id, room)
    emit('status', {'message': f'Left room: {room}'}, room=client_id)


# Configuration options with environment variables
DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() == 'true'
PORT = int(os.getenv('PORT', 5001))

# Set higher log level if debug mode is enabled
if DEBUG_MODE:
    logger.setLevel(logging.DEBUG)
    logger.debug("Debug logging enabled")

# Initialize Supabase client (for database operations only, not auth)
supabase = None
supabase_connected = False

try:
    from supabase import create_client, Client
    
    # Initialize Supabase client
    supabase_url = os.getenv('SUPABASE_URL2')
    supabase_key = os.getenv('SUPABASE_KEY2')
    
    if not supabase_url or not supabase_key:
        logger.error("Supabase credentials are missing! All data operations will fail.")
    else:
        logger.info(f"Initializing Supabase client with URL: {supabase_url[:20]}...")
        supabase = create_client(supabase_url, supabase_key)
        supabase_connected = True
        logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {str(e)}")
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
            response = supabase.table('UserData').select('*').eq('AccessToken', token).execute()
            
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
        "debug_mode": DEBUG_MODE,
        "environment": {
            "supabase_url_set": bool(os.getenv('SUPABASE_URL2')),
            "supabase_key_set": bool(os.getenv('SUPABASE_KEY2')),
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
        watchlist = {
            "_id": str(uuid.uuid4()),
            "isin": []
        }
        
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

# Watchlist APIs
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
def create_watchlist(current_user):
    if request.method == 'OPTIONS':
        return _handle_options()
    
    data = request.get_json() or {}
    user_id = current_user['UserID']
    logger.info(f"Create watchlist for user: {user_id}")

    try:
        # Check if create or add to watchlist
        operation = data.get('operation')
        
        if operation == 'create':
            new_watchlist = {
                "_id": str(uuid.uuid4()),
                "watchlistName": data.get('watchlistName', 'My Watchlist'),
                "isin": []
            }

            watchlists = current_user.get('WatchListID', [])
            if watchlists is None or not isinstance(watchlists, list):
                watchlists = []
            
            watchlists.append(new_watchlist)

            if not supabase_connected:
                return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503

            supabase.table('UserData').update({'WatchListID': watchlists}).eq('UserID', user_id).execute()

            logger.debug(f"Watchlist created successfully for user: {user_id}")
            return jsonify({'watchlist': new_watchlist, 'watchlists': watchlists}), 201
            
        elif operation == 'add_isin':
            # This section handles adding an ISIN to a specific watchlist
            watchlist_id = data.get('watchlist_id')
            isin = data.get('isin')
            
            if not isin:
                return jsonify({'message': 'Missing required fields! isin is required.'}), 400

            if not isinstance(isin, str) or len(isin) != 12 or not isin.isalnum():
                return jsonify({'message': 'Invalid ISIN format! ISIN must be a 12-character alphanumeric code.'}), 400
                
            if not watchlist_id:
                return jsonify({'message': 'Missing required fields! watchlist_id is required.'}), 400
                
            watchlists = current_user.get('WatchListID', [])
            if watchlists is None or not isinstance(watchlists, list):
                watchlists = [{
                    "_id": str(uuid.uuid4()),
                    "watchlistName": "My Watchlist",
                    "isin": []
                }]
                
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
        else:
            return jsonify({'message': 'Invalid operation! Use "create" or "add_isin".'}), 400

    except Exception as e:
        logger.error(f"Watchlist operation error: {str(e)}")
        return jsonify({'message': f'Failed to perform watchlist operation: {str(e)}'}), 500


@app.route('/api/watchlist/<watchlist_id>/isin/<isin>', methods=['DELETE', 'OPTIONS'])
@auth_required
def remove_from_watchlist(current_user, watchlist_id, isin):
    if request.method == 'OPTIONS':
        return _handle_options()

    user_id = current_user['UserID']
    logger.info(f"Remove ISIN {isin} from watchlist {watchlist_id} for user: {user_id}")

    try:
        watchlists = current_user.get('WatchListID', [])

        if watchlists is None or not isinstance(watchlists, list) or not watchlists:
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

        if watchlists is None or not isinstance(watchlists, list) or not watchlists:
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

        if watchlists is None or not isinstance(watchlists, list) or not watchlists:
            return jsonify({'message': 'No watchlists found!'}), 404

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
    """Endpoint to get corporate filings with improved date handling"""
    if request.method == 'OPTIONS':
        return _handle_options()
        
    try:
        # Get query parameters with proper error handling
        start_date = request.args.get('start_date', '')
        end_date = request.args.get('end_date', '')
        category = request.args.get('category', '')
        symbol = request.args.get('symbol', '')
        isin = request.args.get('isin', '')
        
        logger.info(f"Corporate filings request: start_date={start_date}, end_date={end_date}, category={category}, symbol={symbol}, isin={isin}")
        
        if not supabase_connected:
            logger.error("Database service unavailable")
            return jsonify({'message': 'Database service unavailable. Please try again later.', 'status': 'error'}), 503
        
        # Build main query
        query = supabase.table('corporatefilings').select('*')
        
        # Order by date descending - most recent first
        query = query.order('date', desc=True)
        
        # Apply date filters if provided, using ISO format for correct string comparison
        if start_date:
            try:
                # Parse user input (YYYY-MM-DD)
                start_dt = datetime.datetime.strptime(start_date, '%Y-%m-%d')
                # Convert to ISO format with time at start of day (00:00:00)
                start_iso = start_dt.isoformat()
                logger.debug(f"Filtering dates >= {start_iso}")
                query = query.gte('date', start_iso)
            except ValueError as e:
                logger.error(f"Invalid start_date format: {start_date} - {str(e)}")
                return jsonify({'message': 'Invalid start_date format. Use YYYY-MM-DD', 'status': 'error'}), 400
        
        if end_date:
            try:
                # Parse user input (YYYY-MM-DD)
                end_dt = datetime.datetime.strptime(end_date, '%Y-%m-%d')
                # Set time to end of day (23:59:59)
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
                # Convert to ISO format
                end_iso = end_dt.isoformat()
                logger.debug(f"Filtering dates <= {end_iso}")
                query = query.lte('date', end_iso)
            except ValueError as e:
                logger.error(f"Invalid end_date format: {end_date} - {str(e)}")
                return jsonify({'message': 'Invalid end_date format. Use YYYY-MM-DD', 'status': 'error'}), 400
        
        # Apply additional filters if provided
        if category:
            query = query.eq('category', category)
        if symbol:
            query = query.eq('symbol', symbol)
        if isin:
            query = query.eq('isin', isin)
        
        # Execute query with error handling
        try:
            logger.debug("Executing Supabase query")
            response = query.execute()
            
            # Log the full response for debugging
            logger.debug(f"Query response: {response}")
            
            # Return results
            result_count = len(response.data) if response.data else 0
            logger.info(f"Retrieved {result_count} corporate filings")
            
            # If no results, try to return without date filters as fallback
            if result_count == 0:
                logger.warning("No results found with date filters, trying without filters")
                try:
                    # Build a simpler query without date filters
                    simple_query = supabase.table('corporatefilings').select('*').limit(10)
                    if category:
                        simple_query = simple_query.eq('category', category)
                    if symbol:
                        simple_query = simple_query.eq('symbol', symbol)
                    if isin:
                        simple_query = simple_query.eq('isin', isin)
                    
                    simple_response = simple_query.execute()
                    if simple_response.data and len(simple_response.data) > 0:
                        logger.info(f"Retrieved {len(simple_response.data)} filings without date filters")
                        return jsonify({
                            'count': len(simple_response.data),
                            'filings': simple_response.data,
                            'note': 'Date filters were ignored to return results'
                        }), 200
                except Exception as e:
                    logger.error(f"Fallback query also failed: {str(e)}")
                
                # If we still have no results, try the test data
                test_filings = generate_test_filings()
                logger.info("Returning generated test filings as fallback")
                return jsonify({
                    'count': len(test_filings),
                    'filings': test_filings,
                    'note': 'Using test data as fallback'
                }), 200
            
            # Return the actual results
            return jsonify({
                'count': result_count,
                'filings': response.data
            }), 200
            
        except Exception as e:
            logger.error(f"Supabase query error: {str(e)}")
            # Return test data as fallback
            test_filings = generate_test_filings()
            logger.info("Returning generated test filings due to query error")
            return jsonify({
                'count': len(test_filings),
                'filings': test_filings,
                'note': 'Using test data due to database error'
            }), 200
    
    except Exception as e:
        # Log the full error details
        logger.error(f"Unexpected error in get_corporate_filings: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Always return test data in case of unhandled errors
        test_filings = generate_test_filings()
        return jsonify({
            'count': len(test_filings),
            'filings': test_filings,
            'note': 'Using test data due to server error'
        }), 200

# Helper function to generate test filings
def generate_test_filings():
    """Generate test filing data for when database is unavailable"""
    current_time = datetime.datetime.now()
    
    return [
        {
            "id": f"test-1-{current_time.timestamp()}",
            "Symbol": "TC1",
            "symbol": "TC1",
            "ISIN": "TEST1234567890",
            "isin": "TEST1234567890",
            "Category": "Financial Results",
            "category": "Financial Results",
            "summary": "Test Company 1 announces financial results for Q1 2025",
            "ai_summary": "**Category:** Financial Results\n**Headline:** Q1 2025 Results\n\nTest Company 1 announces financial results for Q1 2025 with a 15% increase in revenue.",
            "date": current_time.isoformat(),
            "companyname": "Test Company 1",
            "corp_id": f"test-corp-1-{current_time.timestamp()}"
        },
        {
            "id": f"test-2-{current_time.timestamp()}",
            "Symbol": "TC2", 
            "symbol": "TC2",
            "ISIN": "TEST2234567890",
            "isin": "TEST2234567890",
            "Category": "Dividend",
            "category": "Dividend",
            "summary": "Test Company 2 announces dividend for shareholders",
            "ai_summary": "**Category:** Dividend\n**Headline:** Dividend Announcement\n\nTest Company 2 announces a dividend of ₹5 per share for shareholders, payable on June 15, 2025.",
            "date": (current_time - datetime.timedelta(days=1)).isoformat(),
            "companyname": "Test Company 2",
            "corp_id": f"test-corp-2-{current_time.timestamp()}"
        },
        {
            "id": f"test-3-{current_time.timestamp()}",
            "Symbol": "TC3",
            "symbol": "TC3",
            "ISIN": "TEST3234567890",
            "isin": "TEST3234567890",
            "Category": "Mergers & Acquisitions",
            "category": "Mergers & Acquisitions",
            "summary": "Test Company 3 announces merger with another company",
            "ai_summary": "**Category:** Mergers & Acquisitions\n**Headline:** Company Merger\n\nTest Company 3 announces a strategic merger with XYZ Corp valued at $500 million, expected to close in Q3 2025.",
            "date": (current_time - datetime.timedelta(days=2)).isoformat(),
            "companyname": "Test Company 3",
            "corp_id": f"test-corp-3-{current_time.timestamp()}"
        }
    ]

# Improved test endpoint that always returns data
@app.route('/api/test_corporate_filings', methods=['GET', 'OPTIONS'])
def test_corporate_filings():
    """Reliable test endpoint for corporate filings"""
    if request.method == 'OPTIONS':
        return _handle_options()
    
    # Generate test filings that match your schema
    test_filings = generate_test_filings()
    
    # Apply any filters from the query parameters (optional)
    start_date = request.args.get('start_date', '')
    end_date = request.args.get('end_date', '')
    category = request.args.get('category', '')
    
    logger.info(f"Test corporate filings request with filters: start_date={start_date}, end_date={end_date}, category={category}")
    
    # Log that we're using test data
    logger.info(f"Returning {len(test_filings)} test filings")
    
    return jsonify({
        'count': len(test_filings),
        'filings': test_filings,
        'note': 'This is test data from the test endpoint'
    }), 200

# @# Add this to the top of your liveserver.py file, after the existing imports

# Advanced in-memory cache for deduplication
class AnnouncementCache:
    """Cache to prevent duplicate announcement processing"""
    def __init__(self, max_size=1000):
        self.cache = {}  # Main cache
        self.cache_by_content = {}  # Secondary cache using content hash
        self.max_size = max_size
        self.access_order = []  # For LRU eviction

    def _generate_content_hash(self, data):
        """Create a hash from announcement content for deduplication"""
        # Use multiple fields to generate a more robust hash
        hash_fields = []
        
        # Try different field combinations
        if 'companyname' in data and 'summary' in data:
            hash_fields.append(f"{data['companyname']}:{data['summary'][:100]}")
        
        if 'company' in data and 'summary' in data:
            hash_fields.append(f"{data['company']}:{data['summary'][:100]}")
            
        if 'Symbol' in data and 'summary' in data:
            hash_fields.append(f"{data['Symbol']}:{data['summary'][:100]}")
            
        if 'symbol' in data and 'summary' in data:
            hash_fields.append(f"{data['symbol']}:{data['summary'][:100]}")
        
        if 'ai_summary' in data:
            hash_fields.append(data['ai_summary'][:100])
            
        # Fallback if none of the above are present
        if not hash_fields:
            # Use whatever we can find as a hash source
            for key in ['headline', 'title', 'description', 'text']:
                if key in data and data[key]:
                    hash_fields.append(str(data[key])[:100])
                    break
            
            # Last resort
            if not hash_fields:
                return None
        
        # Create a hash from the combined fields
        hash_source = "||".join(hash_fields)
        return hashlib.md5(hash_source.encode()).hexdigest()

    def _update_access(self, key):
        """Update the access order for LRU eviction"""
        if key in self.access_order:
            self.access_order.remove(key)
        self.access_order.append(key)
        
        # Evict oldest if cache exceeds max size
        while len(self.cache) > self.max_size:
            oldest_key = self.access_order.pop(0)
            content_hash = self.cache.get(oldest_key, {}).get('content_hash')
            if content_hash and content_hash in self.cache_by_content:
                del self.cache_by_content[content_hash]
            if oldest_key in self.cache:
                del self.cache[oldest_key]

    def contains(self, data):
        """Check if announcement is already in cache"""
        # Check by ID
        announcement_id = data.get('id') or data.get('corp_id')
        if announcement_id and announcement_id in self.cache:
            self._update_access(announcement_id)
            return True
            
        # Check by content hash
        content_hash = self._generate_content_hash(data)
        if content_hash and content_hash in self.cache_by_content:
            self._update_access(content_hash)
            return True
            
        return False

    def add(self, data):
        """Add announcement to cache"""
        announcement_id = data.get('id') or data.get('corp_id')
        if not announcement_id:
            # Generate an ID if none exists
            announcement_id = f"generated-{datetime.datetime.now().timestamp()}"
        
        # Generate content hash
        content_hash = self._generate_content_hash(data)
        
        # Store metadata
        timestamp = datetime.datetime.now().isoformat()
        
        # Store in primary cache
        self.cache[announcement_id] = {
            'timestamp': timestamp,
            'content_hash': content_hash
        }
        
        # Store in content hash cache if available
        if content_hash:
            self.cache_by_content[content_hash] = {
                'id': announcement_id,
                'timestamp': timestamp
            }
        
        self._update_access(announcement_id)
        
        return announcement_id

# Initialize the cache
announcement_cache = AnnouncementCache(max_size=5000)

# Then replace your insert_new_announcement function with this improved version:

@app.route('/api/save_announcement', methods=['POST', 'OPTIONS'])
def save_announcement():
    """Endpoint to save announcements to the database without WebSocket broadcast"""
    if request.method == 'OPTIONS':
        return _handle_options()
        
    try:
        data = request.get_json()
        
        if not data:
            logger.warning("Received empty announcement data")
            return jsonify({'message': 'Missing data!', 'status': 'error'}), 400
        
        # Add timestamp if not present
        if 'timestamp' not in data:
            data['timestamp'] = datetime.datetime.now().isoformat()
        
        # Add a unique ID if not present
        if 'id' not in data and 'corp_id' not in data:
            data['id'] = f"announcement-{datetime.datetime.now().timestamp()}"
            
        # Log the save operation
        logger.info(f"Saving announcement to database (no broadcast): {data.get('companyname', 'Unknown')}: {data.get('summary', '')[:100]}...")
        
        # Save to database if we have Supabase connection
        if supabase_connected:
            try:
                # Check if the announcement already exists
                search_id =data.get('corp_id')
                exists = False
                
                if search_id:
                    response = supabase.table('corporatefilings').select('corp_id').eq('corp_id', search_id).execute()
                    exists = response.data and len(response.data) > 0
                
                if not exists:
                    # Insert into database
                    supabase.table('corporatefilings').insert(data).execute()
                    logger.debug(f"Announcement saved to database with ID: {search_id}")
                else:
                    logger.debug(f"Announcement already exists in database, skipping insert: {search_id}")
                    
                return jsonify({
                    'message': 'Announcement saved to database successfully',
                    'status': 'success',
                    'is_new': False,
                    'exists': exists
                }), 200
                
            except Exception as e:
                logger.error(f"Database error saving announcement: {str(e)}")
                return jsonify({'message': f'Database error: {str(e)}', 'status': 'error'}), 500
        else:
            logger.warning("Supabase not connected, announcement not saved to database")
            return jsonify({'message': 'Database not connected', 'status': 'error'}), 503
            
    except Exception as e:
        # Log the full error trace for debugging
        logger.error(f"Error saving announcement: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'message': f'Error saving announcement: {str(e)}', 'status': 'error'}), 500

# Now update the insert_new_announcement endpoint to be clearer about its dual purpose
@app.route('/api/insert_new_announcement', methods=['POST', 'OPTIONS'])
def insert_new_announcement():
    """Endpoint to save announcements to database AND broadcast via WebSocket"""
    if request.method == 'OPTIONS':
        return _handle_options()
        
    try:
        data = request.get_json()
        
        if not data:
            logger.warning("Received empty announcement data")
            return jsonify({'message': 'Missing data!', 'status': 'error'}), 400
        
        # Add timestamp if not present
        if 'timestamp' not in data:
            data['timestamp'] = datetime.datetime.now().isoformat()
        
        # Add a unique ID if not present
        if 'id' not in data and 'corp_id' not in data:
            data['id'] = f"announcement-{datetime.datetime.now().timestamp()}"
        
        # Generate a deduplication hash for frontend
        dedup_hash = hashlib.md5(f"{data.get('companyname', '')}-{data.get('summary', '')[:100]}".encode()).hexdigest()
        data['dedup_id'] = dedup_hash
        
        # Check if the announcement exists in the database
        announcement_exists = False
        if supabase_connected:
            try:
                search_id =data.get('corp_id')
                if search_id:
                    response = supabase.table('corporatefilings').select('corp_id').eq('corp_id', search_id).execute()
                    announcement_exists = response.data and len(response.data) > 0
            except Exception as e:
                logger.warning(f"Error checking database for existing announcement: {str(e)}")
        
        # First, save to database regardless of whether it's broadcast
        if supabase_connected and not announcement_exists:
            try:
                supabase.table('corporatefilings').insert(data).execute()
                logger.debug(f"Announcement saved to database: {data.get('corp_id')}")
            except Exception as e:
                logger.error(f"Error saving to database: {str(e)}")
        elif announcement_exists:
            logger.debug(f"Announcement already exists in database, skipping insert")
        
        # Now handle broadcasting via WebSocket
        # Only broadcast if it's explicitly marked for broadcast or has is_fresh flag
        should_broadcast = data.get('broadcast', False) or data.get('is_fresh', False)
        
        if should_broadcast:
            # Log announcement
            logger.info(f"Broadcasting announcement: {data.get('companyname', 'Unknown')}: {data.get('summary', '')[:100]}...")
            
            # Broadcast to all clients
            socketio.emit('new_announcement', data)
            
            # Broadcast to specific rooms
            rooms = ['all']  # Always broadcast to 'all' room
            
            # ISIN-specific room
            if 'isin' in data and data['isin']:
                isin_room = data['isin']
                socketio.emit('new_announcement', data, room=isin_room)
                rooms.append(isin_room)
            
            # Symbol/ticker-specific room
            if 'symbol' in data and data['symbol']:
                symbol_room = data['symbol']
                socketio.emit('new_announcement', data, room=symbol_room)
                rooms.append(symbol_room)
                
            # Company-specific room
            if 'companyname' in data and data['companyname']:
                company_room = f"company:{data['companyname']}"
                socketio.emit('new_announcement', data, room=company_room)
                rooms.append(company_room)
                
            # Category-specific room
            if 'category' in data and data['category']:
                category_room = f"category:{data['category']}"
                socketio.emit('new_announcement', data, room=category_room)
                rooms.append(category_room)
            
            logger.info(f"Announcement broadcast to rooms: {', '.join(rooms)}")
            
            return jsonify({
                'message': 'Announcement saved to database and broadcast via WebSocket',
                'status': 'success',
                'rooms': rooms,
                'is_new': True,
                'broadcast': True
            }), 200
        else:
            # If not broadcasting, just report successful database save
            logger.info(f"Announcement saved to database (no broadcast): {data.get('companyname', 'Unknown')}")
            return jsonify({
                'message': 'Announcement saved to database (no broadcast)',
                'status': 'success',
                'is_new': False, 
                'broadcast': False
            }), 200
            
    except Exception as e:
        # Log the full error trace for debugging
        logger.error(f"Error processing announcement: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'message': f'Error processing announcement: {str(e)}', 'status': 'error'}), 500

# Testing endpoint to manually send a test announcement
@app.route('/api/test_announcement', methods=['POST', 'OPTIONS'])
def test_announcement():
    """Endpoint to manually send a test announcement for testing WebSocket"""
    if request.method == 'OPTIONS':
        return _handle_options()
        
    try:
        # Create test announcement data
        test_announcement = {
            'id': f"test-{datetime.datetime.now().timestamp()}",
            'companyname': 'Anshul',
            'symbol': 'ANSHUL',
            'category': 'ABC',
            'summary': 'Just Checking in',
            'ai_summary': '**Category:** Test Announcement\n**Headline:** Test WebSocket Functionality\n\nThis is a test announcement to verify WebSocket functionality.',
            'isin': 'TEST12345678',
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        # Broadcast to all clients
        socketio.emit('new_announcement', test_announcement)
        logger.info("Broadcasted test announcement to all clients")
        
        return jsonify({
            'message': 'Test announcement sent successfully!',
            'status': 'success'
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending test announcement: {str(e)}")
        return jsonify({'message': f'Error sending test announcement: {str(e)}', 'status': 'error'}), 500

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
            
        # Initialize the Supabase query
        supabase_query = supabase.table('dhanstockdata').select('*')
        
        # Apply search filters (case-insensitive)
        search_pattern = f"%{query}%"
        
        # Build the query with proper OR conditions
        or_filter = (
            f"newname.ilike.{search_pattern},"
            f"oldname.ilike.{search_pattern},"
            f"newnsecode.ilike.{search_pattern},"
            f"oldnsecode.ilike.{search_pattern},"
            f"newbsecode.ilike.{search_pattern},"
            f"oldbsecode.ilike.{search_pattern},"
            f"isin.ilike.{search_pattern}"
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

# List all users (admin endpoint)
@app.route('/api/users', methods=['GET', 'OPTIONS'])
def list_users():
    if request.method == 'OPTIONS':
        return _handle_options()
    
    if not supabase_connected:
        return jsonify({'message': 'Database service unavailable. Please try again later.'}), 503
        
    try:
        # Get all users from the UserData table
        response = supabase.table('UserData').select('*').execute()
        
        # Remove sensitive information
        users = []
        for user in response.data:
            safe_user = {k: v for k, v in user.items() if k.lower() not in ['password', 'accesstoken']}
            users.append(safe_user)
            
        return jsonify({
            'count': len(users),
            'users': users
        }), 200
    except Exception as e:
        logger.error(f"List users error: {str(e)}")
        return jsonify({'message': f'Failed to list users: {str(e)}'}), 500

# Function to start the BSE scraper
# Function to start the BSE scraper
# Add this function to your liveserver.py file to fix the error

def start_scraper():
    """Start the BSE scraper in a separate thread with better error handling"""
    try:
        logger.info("Starting BSE scraper in background thread...")
        
        # Get the path to the bse_scraper.py file
        scraper_path = Path(__file__).parent / "new_scraper.py"
        
        if not scraper_path.exists():
            logger.error(f"Scraper file not found at: {scraper_path}")
            return
            
        # Import the scraper module dynamically
        spec = importlib.util.spec_from_file_location("new_scraper", scraper_path)
        scraper_module = importlib.util.module_from_spec(spec)
        sys.modules["new_scraper"] = scraper_module
        spec.loader.exec_module(scraper_module)
        
        # Create and run the scraper
        today = datetime.datetime.today().strftime('%Y%m%d')
        
        try:
            # Create a flag file to signal that this is the first run
            first_run_flag_path = Path(__file__).parent / "data" / "first_run_flag.txt"
            os.makedirs(os.path.dirname(first_run_flag_path), exist_ok=True)
            
            # Mark as first run by creating the flag file
            with open(first_run_flag_path, 'w') as f:
                f.write(f"First run on {datetime.datetime.now().isoformat()}")
            
            logger.info("Created first run flag file")
                
            # Initialize the scraper
            scraper = scraper_module.BseScraper(today, today)
            
            # First run - this will use the flag file internally
            try:
                scraper.run()  # No parameter passed here
                logger.info("Initial scraper run completed")
            except Exception as e:
                logger.error(f"Error in initial scraper run: {str(e)}")
                logger.error(traceback.format_exc())
            
            # Remove the first run flag file
            if os.path.exists(first_run_flag_path):
                os.remove(first_run_flag_path)
                logger.info("Removed first run flag file")
            
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
                    
                    # Run the scraper (after the first run)
                    scraper.run()
                    
                except Exception as e:
                    logger.error(f"Error in periodic scraper run: {str(e)}")
                    logger.error(traceback.format_exc())
                    # Continue the loop even after errors
            
        except Exception as e:
            logger.error(f"Error creating scraper instance: {str(e)}")
            logger.error(traceback.format_exc())
            
    except Exception as e:
        logger.error(f"Error importing scraper module: {str(e)}")
        logger.error(traceback.format_exc())

# Custom error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint not found!'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'message': 'Method not allowed!'}), 405

@app.errorhandler(500)
def internal_server_error(error):
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({'message': 'Internal server error!'}), 500

if __name__ == '__main__':
    # Print environment status
    logger.info(f"Starting Financial Backend API (Custom Auth) on port {PORT}")
    logger.info(f"Debug Mode: {'ENABLED' if DEBUG_MODE else 'DISABLED'}")
    logger.info(f"Supabase URL: {'Available' if os.getenv('SUPABASE_URL2') else 'Missing'}")
    logger.info(f"Supabase Key: {'Available' if os.getenv('SUPABASE_KEY2') else 'Missing'}")
    logger.info(f"Supabase Connection: {'Successful' if supabase_connected else 'FAILED'}")
    
    # Debug mode helps with development but should be disabled in production
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    logger.info(f"Flask Debug Mode: {'ENABLED' if debug_mode else 'DISABLED'}")
    logger.info(f"Health endpoint: http://localhost:{PORT}/health")
    logger.info(f"API health endpoint: http://localhost:{PORT}/api/health")
    logger.info(f"WebSocket server enabled on port {PORT}")
    
    # Start the scraper in a separate thread
    logger.info("Starting scraper thread...")
    scraper_thread = threading.Thread(target=start_scraper, daemon=True)
    scraper_thread.start()
    logger.info("Scraper thread started")
    
    # Run the application with Socket.IO instead of the standard Flask server
    socketio.run(app, debug=debug_mode, host='0.0.0.0', port=PORT, allow_unsafe_werkzeug=True)