#!/usr/bin/env bash
# Exit on error
set -e

if [ -d "backend" ]; then
  cd backend
fi

bash build.sh
