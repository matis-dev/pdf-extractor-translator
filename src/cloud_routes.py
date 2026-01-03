
import os
import json
import requests
from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from werkzeug.utils import secure_filename
from webdav3.client import Client as WebDavClient
import dropbox
from dropbox import DropboxOAuth2Flow

cloud_bp = Blueprint('cloud_routes', __name__)

# Google Drive Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

# ... (Previous Google Code) ...

# --- Nextcloud / WebDAV Routes ---

@cloud_bp.route('/api/cloud/nextcloud/connect', methods=['POST'])
def nextcloud_connect():
    """Validates Nextcloud credentials and stores them in session."""
    data = request.json
    url = data.get('url')
    user = data.get('user')
    password = data.get('password')
    
    if not url or not user or not password:
        return jsonify({"error": "Missing credentials"}), 400
        
    # Validation options
    options = {
        'webdav_hostname': url,
        'webdav_login': user,
        'webdav_password': password,
        'disable_check_certificate_authority': True # Common for self-hosted
    }
    
    try:
        client = WebDavClient(options)
        # Try to list root to verify auth
        client.list()
        
        # Store in session
        session['nc_config'] = options
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"error": f"Connection failed: {str(e)}"}), 401

@cloud_bp.route('/api/cloud/nextcloud/list')
def nextcloud_list():
    """Lists files from Nextcloud."""
    if 'nc_config' not in session:
        return jsonify({"error": "Not authenticated"}), 401
        
    path = request.args.get('folderId', '/') # folderId acts as path here
    
    try:
        client = WebDavClient(session['nc_config'])
        
        # WebDavClient list returns list of dicts or strings depending on version/config
        # Usually: [{'path': ..., 'isDirectory': ..., 'size': ...}]
        # But `list` method often just returns filenames if not configured for details.
        # We should use `list(get_info=True)` if available or parse.
        # webdavclient3 `list` returns simple list of names by default. 
        # `list(remote_path=path)`
        
        # Taking a safer approach using .info() iteration or checking capabilities
        # Let's try grabbing listing.
        files_raw = client.list(path)
        
        # We need to distinguish files and folders. 
        # The client might just give names. 
        # For better UI, we need metadata. 
        # Let's iterate and get info (slow but standard) OR use propfind if client exposes it.
        # webdavclient3 actually returns just names. We can check type for each.
        
        items = []
        for filename in files_raw:
             # Skip empty or current dir
             if not filename: continue
             
             full_path = os.path.join(path, filename).replace('\\', '/')
             info = client.info(full_path)
             
             is_dir = info.get('type') == 'directory'
             mime_type = 'application/vnd.google-apps.folder' if is_dir else info.get('content_type', 'application/pdf')
             
             # Filter: Show folders and PDFs only
             if not is_dir and not filename.lower().endswith('.pdf'):
                 continue
                 
             items.append({
                 'id': full_path, # Path is the ID for WebDAV
                 'name': filename,
                 'mimeType': mime_type,
                 'type': 'folder' if is_dir else 'file'
             })
             
        return jsonify({"files": items})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cloud_bp.route('/api/cloud/nextcloud/download', methods=['POST'])
def nextcloud_download():
    """Downloads a file from Nextcloud."""
    data = request.json
    file_path = data.get('fileId') # This is the path
    file_name = data.get('fileName')
    
    if not file_path or 'nc_config' not in session:
        return jsonify({"error": "Invalid request"}), 400
        
    try:
        client = WebDavClient(session['nc_config'])
        
        if not file_name:
            file_name = os.path.basename(file_path)
            
        file_name = secure_filename(file_name)
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_name)
        
        client.download_sync(remote_path=file_path, local_path=save_path)
        
        return jsonify({"success": True, "filename": file_name})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Scopes
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def get_google_flow(redirect_uri=None):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
         return None
         
    # Minimal client config
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "project_id": "pdf-extractor-app",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uris": [redirect_uri] if redirect_uri else []
        }
    }
    
    return Flow.from_client_config(
        client_config=client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

# --- Dropbox Routes ---

# Config
DROPBOX_APP_KEY = os.environ.get('DROPBOX_APP_KEY')
DROPBOX_APP_SECRET = os.environ.get('DROPBOX_APP_SECRET')

def get_dropbox_auth_flow(redirect_uri):
    if not DROPBOX_APP_KEY or not DROPBOX_APP_SECRET:
         return None
         
    return DropboxOAuth2Flow(
        DROPBOX_APP_KEY,
        DROPBOX_APP_SECRET,
        redirect_uri,
        session,
        "dropbox-auth-csrf-token"
    )

@cloud_bp.route('/auth/dropbox/url')
def dropbox_auth_url():
    redirect_uri = url_for('cloud_routes.dropbox_auth_callback', _external=True)
    flow = get_dropbox_auth_flow(redirect_uri)
    
    if not flow:
         return jsonify({"error": "Dropbox credentials not configured"}), 500
         
    auth_url = flow.start()
    return jsonify({"url": auth_url})

@cloud_bp.route('/auth/dropbox/callback')
def dropbox_auth_callback():
    redirect_uri = url_for('cloud_routes.dropbox_auth_callback', _external=True)
    flow = get_dropbox_auth_flow(redirect_uri)
    
    if not flow:
        return "Config error", 500
        
    try:
        oauth_result = flow.finish(request.args)
        # Store token
        session['dropbox_token'] = oauth_result.access_token
        
        return """
        <script>
            window.opener.postMessage({type: 'DROPBOX_AUTH_SUCCESS'}, '*');
            window.close();
        </script>
        """
    except Exception as e:
        return f"Auth failed: {e}", 400

@cloud_bp.route('/api/cloud/dropbox/list')
def dropbox_list():
    if 'dropbox_token' not in session:
        return jsonify({"error": "Not authenticated"}), 401
        
    try:
        dbx = dropbox.Dropbox(session['dropbox_token'])
        
        # Dropbox uses path "" for root, not "/"
        path = request.args.get('folderId', '')
        if path == '/': path = ''
        
        res = dbx.files_list_folder(path)
        items = []
        
        for entry in res.entries:
            # Determine type
            is_dir = isinstance(entry, dropbox.files.FolderMetadata)
            is_file = isinstance(entry, dropbox.files.FileMetadata)
            
            # Filter
            if not is_dir and not entry.name.lower().endswith('.pdf'):
                continue
                
            items.append({
                'id': entry.path_lower, # Use path as ID
                'name': entry.name,
                'type': 'folder' if is_dir else 'file',
                'mimeType': 'application/vnd.google-apps.folder' if is_dir else 'application/pdf'
            })
            
        return jsonify({"files": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cloud_bp.route('/api/cloud/dropbox/download', methods=['POST'])
def dropbox_download():
    data = request.json
    path = data.get('fileId')
    file_name = data.get('fileName')
    
    if not path or 'dropbox_token' not in session:
        return jsonify({"error": "Invalid request"}), 400
        
    try:
        dbx = dropbox.Dropbox(session['dropbox_token'])
        
        if not file_name:
            # Metadata fetch?
            file_name = os.path.basename(path)
            
        file_name = secure_filename(file_name)
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_name)
        
        dbx.files_download_to_file(save_path, path)
        
        return jsonify({"success": True, "filename": file_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ... (End of file, no duplicate get_google_flow)

# --- OneDrive Routes ---
# Using MSAL

MS_CLIENT_ID = os.environ.get('MS_CLIENT_ID')
MS_CLIENT_SECRET = os.environ.get('MS_CLIENT_SECRET')
MS_AUTHORITY = 'https://login.microsoftonline.com/common'
MS_SCOPES = ['Files.Read']

import msal

def get_msal_app():
    if not MS_CLIENT_ID or not MS_CLIENT_SECRET:
        return None
        
    return msal.ConfidentialClientApplication(
        MS_CLIENT_ID,
        authority=MS_AUTHORITY,
        client_credential=MS_CLIENT_SECRET
    )

@cloud_bp.route('/auth/onedrive/url')
def onedrive_auth_url():
    app = get_msal_app()
    if not app:
        return jsonify({"error": "Microsoft credentials not configured"}), 500
        
    redirect_uri = url_for('cloud_routes.onedrive_auth_callback', _external=True)
    auth_url = app.get_authorization_request_url(
        MS_SCOPES,
        redirect_uri=redirect_uri
    )
    return jsonify({"url": auth_url})

@cloud_bp.route('/auth/onedrive/callback')
def onedrive_auth_callback():
    app = get_msal_app()
    if not app:
         return "Config error", 500
         
    code = request.args.get('code')
    if not code:
         return "No code provided", 400
         
    redirect_uri = url_for('cloud_routes.onedrive_auth_callback', _external=True)
    result = app.acquire_token_by_authorization_code(
        code,
        scopes=MS_SCOPES,
        redirect_uri=redirect_uri
    )
    
    if "error" in result:
        return f"Auth failed: {result.get('error_description')}", 400
        
    session['onedrive_token'] = result
    
    return """
    <script>
        window.opener.postMessage({type: 'ONEDRIVE_AUTH_SUCCESS'}, '*');
        window.close();
    </script>
    """

@cloud_bp.route('/api/cloud/onedrive/list')
def onedrive_list():
    if 'onedrive_token' not in session:
        return jsonify({"error": "Not authenticated"}), 401
        
    token = session['onedrive_token']['access_token']
    
    # Graph API
    folder_id = request.args.get('folderId')
    endpoint = f"https://graph.microsoft.com/v1.0/me/drive/items/{folder_id}/children" if folder_id else "https://graph.microsoft.com/v1.0/me/drive/root/children"
    
    try:
        resp = requests.get(endpoint, headers={'Authorization': 'Bearer ' + token})
        if resp.status_code != 200:
             return jsonify({"error": f"Graph API Error: {resp.status_code}"}), resp.status_code
             
        data = resp.json()
        items = []
        
        for entry in data.get('value', []):
            is_folder = 'folder' in entry
            is_file = 'file' in entry
            
            if not is_folder and not entry.get('name', '').lower().endswith('.pdf'):
                continue
                
            items.append({
                'id': entry['id'],
                'name': entry['name'],
                'type': 'folder' if is_folder else 'file',
                'mimeType': 'application/vnd.google-apps.folder' if is_folder else entry.get('file', {}).get('mimeType', 'application/pdf')
            })
            
        return jsonify({"files": items})
        
    except Exception as e:
         return jsonify({"error": str(e)}), 500

@cloud_bp.route('/api/cloud/onedrive/download', methods=['POST'])
def onedrive_download():
    data = request.json
    file_id = data.get('fileId')
    file_name = data.get('fileName')
    
    if not file_id or 'onedrive_token' not in session:
         return jsonify({"error": "Invalid request"}), 400
         
    token = session['onedrive_token']['access_token']
    
    try:
        # Get download URL
        resp = requests.get(
            f"https://graph.microsoft.com/v1.0/me/drive/items/{file_id}",
            headers={'Authorization': 'Bearer ' + token}
        )
        meta = resp.json()
        download_url = meta.get('@microsoft.graph.downloadUrl')
        
        if not download_url:
             return jsonify({"error": "Could not get download link"}), 500
             
        if not file_name:
             file_name = meta.get('name', 'download.pdf')
             
        file_name = secure_filename(file_name)
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_name)
        
        # Download actual bytes
        file_resp = requests.get(download_url)
        with open(save_path, 'wb') as f:
             f.write(file_resp.content)
             
        return jsonify({"success": True, "filename": file_name})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cloud_bp.route('/auth/google/url')
def google_auth_url():
    """Generates the Google OAuth URL."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return jsonify({"error": "Google credentials not configured"}), 500
        
    # Redirect URI must match what is configured in Google Console
    redirect_uri = url_for('cloud_routes.google_auth_callback', _external=True)
    
    flow = get_google_flow(redirect_uri)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    # Store state to verify callback
    session['google_oauth_state'] = state
    
    return jsonify({"url": authorization_url})

@cloud_bp.route('/auth/google/callback')
def google_auth_callback():
    """Handles the OAuth callback from Google."""
    state = session.get('google_oauth_state')
    
    flow = get_google_flow(url_for('cloud_routes.google_auth_callback', _external=True))
    if not flow:
         return "Google credentials missing", 500
         
    try:
        flow.fetch_token(authorization_response=request.url)
    except Exception as e:
        return f"Authentication missed: {e}", 400

    credentials = flow.credentials
    session['google_token'] = credentials_to_dict(credentials)
    
    # Close window script
    return """
    <script>
        window.opener.postMessage({type: 'GOOGLE_AUTH_SUCCESS'}, '*');
        window.close();
    </script>
    """

@cloud_bp.route('/api/cloud/google/list')
def google_list_files():
    """Lists files from Google Drive."""
    if 'google_token' not in session:
        return jsonify({"error": "Not authenticated"}), 401
    
    creds_data = session['google_token']
    creds = Credentials(**creds_data)
    
    try:
        service = build('drive', 'v3', credentials=creds)
        
        # Query: MimeType PDF or Folder, not trashed
        query = "(mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.folder') and trashed = false"
        parent_id = request.args.get('folderId')
        if parent_id:
            query += f" and '{parent_id}' in parents"
            
        results = service.files().list(
            q=query,
            pageSize=50,
            fields="nextPageToken, files(id, name, mimeType)"
        ).execute()
        
        items = results.get('files', [])
        
        return jsonify({"files": items})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@cloud_bp.route('/api/cloud/google/download', methods=['POST'])
def google_download_file():
    """Downloads a file from Google Drive to local upload folder."""
    data = request.json
    file_id = data.get('fileId')
    file_name = data.get('fileName')
    
    if not file_id or 'google_token' not in session:
        return jsonify({"error": "Invalid request"}), 400
        
    creds = Credentials(**session['google_token'])
    try:
        service = build('drive', 'v3', credentials=creds)
        
        # Determine actual filename if not provided
        if not file_name:
            file_meta = service.files().get(fileId=file_id).execute()
            file_name = file_meta.get('name', f"download_{file_id}.pdf")
            
        file_name = secure_filename(file_name)
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_name)
        
        # Download
        file_content = service.files().get_media(fileId=file_id).execute()
        
        with open(save_path, 'wb') as f:
            f.write(file_content)
            
        return jsonify({"success": True, "filename": file_name})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... Google Upload ...

@cloud_bp.route('/api/cloud/google/upload', methods=['POST'])
def google_upload_file():
    """Uploads a file from local server to Google Drive."""
    data = request.json
    folder_id = data.get('folderId')
    local_filename = data.get('localFilename')
    # Optional: Allow renaming
    target_filename = data.get('targetFilename', local_filename)
    
    if not local_filename or 'google_token' not in session:
        return jsonify({"error": "Invalid request"}), 400
        
    creds = Credentials(**session['google_token'])
    try:
        service = build('drive', 'v3', credentials=creds)
        
        file_metadata = {
            'name': target_filename,
            'parents': [folder_id] if folder_id else []
        }
        
        local_path = os.path.join(current_app.config['UPLOAD_FOLDER'], local_filename)
        if not os.path.exists(local_path):
             # Try output folder if it was processed? 
             # For now, stick to upload folder or wherever the current file is.
             # The app architecture seems to modify files in place or save to outputs.
             # Let's check session or assume UPLOAD_FOLDER for simplicity of MVP.
             return jsonify({"error": "Local file not found"}), 404
        
        from googleapiclient.http import MediaFileUpload
        media = MediaFileUpload(local_path, mimetype='application/pdf')
        
        file = service.files().create(body=file_metadata,
                                    media_body=media,
                                    fields='id').execute()
                                    
        return jsonify({"success": True, "fileId": file.get('id')})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... Nextcloud Download ...

@cloud_bp.route('/api/cloud/nextcloud/upload', methods=['POST'])
def nextcloud_upload():
    data = request.json
    folder_path = data.get('folderId') # WebDAV path
    local_filename = data.get('localFilename')
    target_filename = data.get('targetFilename', local_filename)
    
    if not local_filename or 'nc_config' not in session:
         return jsonify({"error": "Invalid request"}), 400
         
    try:
        client = WebDavClient(session['nc_config'])
        
        local_path = os.path.join(current_app.config['UPLOAD_FOLDER'], local_filename)
        if not os.path.exists(local_path):
            return jsonify({"error": "Local file not found"}), 404
            
        # Ensure path ends with slash
        remote_path = os.path.join(folder_path, target_filename).replace('\\', '/')
        
        client.upload_sync(remote_path=remote_path, local_path=local_path)
        
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... Dropbox Download ...

@cloud_bp.route('/api/cloud/dropbox/upload', methods=['POST'])
def dropbox_upload():
    data = request.json
    folder_path = data.get('folderId') # Dropbox path
    local_filename = data.get('localFilename')
    target_filename = data.get('targetFilename', local_filename)
    
    if not local_filename or 'dropbox_token' not in session:
        return jsonify({"error": "Invalid request"}), 400
        
    try:
        dbx = dropbox.Dropbox(session['dropbox_token'])
        
        local_path = os.path.join(current_app.config['UPLOAD_FOLDER'], local_filename)
        if not os.path.exists(local_path):
            return jsonify({"error": "Local file not found"}), 404
            
        # Dropbox Path: /folder/file.pdf
        if folder_path == "root" or folder_path == "":
             folder_path = ""
        
        remote_path = f"{folder_path}/{target_filename}".replace('//', '/')
        
        with open(local_path, "rb") as f:
            dbx.files_upload(f.read(), remote_path, mode=dropbox.files.WriteMode.overwrite)
            
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ... OneDrive Download ...

@cloud_bp.route('/api/cloud/onedrive/upload', methods=['POST'])
def onedrive_upload():
    data = request.json
    folder_id = data.get('folderId')
    local_filename = data.get('localFilename')
    target_filename = data.get('targetFilename', local_filename)
    
    if not local_filename or 'onedrive_token' not in session:
         return jsonify({"error": "Invalid request"}), 400
         
    token = session['onedrive_token']['access_token']
    
    try:
        local_path = os.path.join(current_app.config['UPLOAD_FOLDER'], local_filename)
        if not os.path.exists(local_path):
            return jsonify({"error": "Local file not found"}), 404
            
        # Graph API upload (small files < 4MB is simple PUT)
        # /me/drive/items/{parent-id}/children/{filename}/content
        # If folder_id is 'root' or empty, use 'root'
        
        target_id = folder_id if folder_id else 'root'
        
        endpoint = f"https://graph.microsoft.com/v1.0/me/drive/items/{target_id}:/{target_filename}:/content"
        # Wait, strictly speaking: PUT /drive/items/{parent-id}:/{filename}:/content
        
        with open(local_path, 'rb') as f:
            file_content = f.read()
            
        resp = requests.put(
            endpoint,
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/pdf'},
            data=file_content
        )
        
        if resp.status_code not in [200, 201]:
             return jsonify({"error": f"Upload failed: {resp.status_code} {resp.text}"}), resp.status_code
             
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return {'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes}
