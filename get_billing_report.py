import os
import json
import glob
from google.oauth2 import service_account
from google.cloud import billing_v1
from google.cloud import resourcemanager_v3
import pandas as pd
from tabulate import tabulate
import datetime

# Configuration
SEARCH_DIR = "c:/Users/jatro/Dev"

def find_service_account_keys(root_dir):
    keys = []
    # Search for files matching *service-account-key.json pattern recursively
    # Using glob for simpler pattern matching, might be slow on huge dirs but effective here
    print(f"Searching for service account keys in {root_dir}...")
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs:
            dirs.remove('node_modules') # Skip node_modules
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if 'service-account-key.json' in file or 'serviceAccountKey.json' in file:
                 keys.append(os.path.join(root, file))
    return keys

def get_billing_info(creds, project_id=None):
    try:
        # Try to list billing accounts
        billing_client = billing_v1.CloudBillingClient(credentials=creds)
        
        accounts = []
        try:
            # List Billing Accounts
            request = billing_v1.ListBillingAccountsRequest()
            for account in billing_client.list_billing_accounts(request=request):
                accounts.append({
                    "name": account.name,
                    "display_name": account.display_name,
                    "open": account.open_
                })
        except Exception as e:
            # print(f"  - Could not list billing accounts: {e}")
            pass

        # Try to get project billing info if project_id is known from the key
        project_billing = "Unknown"
        if project_id:
            try:
                name = f"projects/{project_id}"
                info = billing_client.get_project_billing_info(name=name)
                project_billing = info.billing_account_name
                if info.billing_enabled:
                    project_billing += " (Enabled)"
                else:
                    project_billing += " (Disabled)"
            except Exception as e:
                project_billing = f"Error: {e}"

        return accounts, project_billing

    except Exception as e:
        return [], f"Client Error: {e}"

def main():
    keys = find_service_account_keys(SEARCH_DIR)
    print(f"Found {len(keys)} key files.")

    results = []

    for key_path in keys:
        try:
            with open(key_path, 'r') as f:
                key_data = json.load(f)
            
            # Basic validation
            if key_data.get('type') != 'service_account':
                continue
            
            project_id = key_data.get('project_id')
            client_email = key_data.get('client_email')
            
            # print(f"Checking {project_id} ({client_email})...")
            
            creds = service_account.Credentials.from_service_account_info(key_data)
            
            # 1. Check Permissions / Billing Info
            item = {
                "Project ID": project_id,
                "Client Email": client_email,
                "Key Path": os.path.basename(key_path), # Accessing file path for reference
                "Billing Accounts Accessible": "No",
                "Project Billing Linked": "Unknown"
            }

            accounts, proj_billing = get_billing_info(creds, project_id)
            
            if accounts:
                acc_names = [f"{a['display_name']} ({a['name']})" for a in accounts]
                item["Billing Accounts Accessible"] = ", ".join(acc_names)
            
            item["Project Billing Linked"] = proj_billing
            
            results.append(item)

        except Exception as e:
            print(f"Error processing {key_path}: {e}")

    if not results:
        print("No valid service account keys found or processed.")
        return

    df = pd.DataFrame(results)
    
    # Filter for unique Projects to avoid duplicates if multiple keys exist for same project
    df_unique = df.drop_duplicates(subset=['Project ID'])
    
    report_str = tabulate(df_unique, headers='keys', tablefmt='grid')
    print("\n" + "="*50)
    print(f"BILLING INFRASTRUCTURE SCAN REPORT - {datetime.datetime.now()}")
    print("="*50)
    print(report_str)
    print("\nNote: 'Billing Accounts Accessible' means this Service Account has permission to view the Billing Account itself.")
    print("      'Project Billing Linked' shows which account pays for this specific project.")
    
    with open('billing_audit.txt', 'w') as f:
        f.write(f"BILLING INFRASTRUCTURE SCAN REPORT - {datetime.datetime.now()}\n")
        f.write("="*50 + "\n")
        f.write(report_str)
        f.write("\n\nNote: 'Billing Accounts Accessible' means this Service Account has permission to view the Billing Account itself.\n")
        f.write("      'Project Billing Linked' shows which account pays for this specific project.\n")

if __name__ == "__main__":
    main()
