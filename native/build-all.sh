#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Building all native modules..."

# Find all directories with build.sh and execute them
for dir in "$SCRIPT_DIR"/*/; do
    if [ -f "${dir}build.sh" ]; then
        module_name=$(basename "$dir")
        echo "Building native module: $module_name"
        bash "${dir}build.sh"
    fi
done

echo "All native modules built successfully"
