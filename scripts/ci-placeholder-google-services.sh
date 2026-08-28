#!/bin/bash
# Creates a placeholder google-services.json for CI builds.
# Includes both release (unifies.cadence) and debug (unifies.cadence.debug) package names.
set -eu

TARGET="android/app/google-services.json"
if [ -f "$TARGET" ]; then
  echo "google-services.json already exists, skipping."
  exit 0
fi

mkdir -p "$(dirname "$TARGET")"

python3 -c "
import json
data = {
    'project_info': {
        'project_number': '000000000000',
        'project_id': 'cadence-ci-placeholder',
        'storage_bucket': 'cadence-ci-placeholder.appspot.com'
    },
    'client': [
        {
            'client_info': {
                'mobilesdk_app_id': '1:000000000000:android:0000000000000000',
                'android_client_info': {'package_name': 'unifies.cadence'}
            },
            'oauth_client': [],
            'api_key': [{'current_key': 'AIzaSyD00000000000000000000000000000000'}],
            'services': {'appinvite_service': {'other_platform_oauth_client': []}}
        },
        {
            'client_info': {
                'mobilesdk_app_id': '1:000000000000:android:0000000000000001',
                'android_client_info': {'package_name': 'unifies.cadence.debug'}
            },
            'oauth_client': [],
            'api_key': [{'current_key': 'AIzaSyD00000000000000000000000000000000'}],
            'services': {'appinvite_service': {'other_platform_oauth_client': []}}
        }
    ],
    'configuration_version': '1'
}
with open('android/app/google-services.json', 'w') as f:
    json.dump(data, f)
"

echo "Created placeholder google-services.json for CI build"
