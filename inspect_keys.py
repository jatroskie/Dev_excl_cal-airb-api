import os
import json

SEARCH_DIR = "c:/Users/jatro/Dev"

def find_service_account_keys(root_dir):
    keys = []
    print(f"Searching for service account keys in {root_dir}...")
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs:
            dirs.remove('node_modules') 
        if '.git' in dirs:
            dirs.remove('.git')
        if '.vscode' in dirs:
            dirs.remove('.vscode')
            
        for file in files:
            if 'service-account-key.json' in file or 'serviceAccountKey.json' in file:
                 keys.append(os.path.join(root, file))
    return keys

def main():
    keys = find_service_account_keys(SEARCH_DIR)
    print(f"Found {len(keys)} key files.")
    
    data = []
    for k in keys:
        try:
            with open(k, 'r') as f:
                j = json.load(f)
                data.append({
                    "path": k,
                    "project_id": j.get("project_id", "UNKNOWN"),
                    "client_email": j.get("client_email", "UNKNOWN")
                })
        except:
            pass
            
    # Print table
    output = []
    output.append(f"{'Project ID':<30} | {'Client Email':<50} | {'Path'}")
    output.append("-" * 120)
    for d in data:
        output.append(f"{d['project_id']:<30} | {d['client_email']:<50} | {d['path']}")
    
    final_output = "\n".join(output)
    print(final_output)
    
    with open('keys_audit.txt', 'w') as f:
        f.write(final_output)

if __name__ == "__main__":
    main()
