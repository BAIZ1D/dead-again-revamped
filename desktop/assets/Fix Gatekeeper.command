#!/bin/bash
# ==============================================================================
# Fix Gatekeeper.command
# Removes macOS Gatekeeper quarantine flag for Dead Again - Revamped (Twitch Edition).
# This allows unsigned community builds to run on macOS without "App is damaged" errors.
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo ""
echo "=================================================================="
echo "   Dead Again - Revamped (Twitch Edition) - Gatekeeper Fix       "
echo "=================================================================="
echo ""
echo "This helper script clears the 'com.apple.quarantine' extended"
echo "attribute that macOS applies to files downloaded from the web."
echo ""
echo "Scanning for Dead Again application bundles..."

# Clear quarantine in standard locations
xattr -cr /Applications/"Dead Again - Revamped (Twitch Edition).app" 2>/dev/null || true
xattr -cr /Applications/"Dead Again.app" 2>/dev/null || true
xattr -cr "$DIR"/"Dead Again - Revamped (Twitch Edition).app" 2>/dev/null || true
xattr -cr "$DIR"/"Dead Again.app" 2>/dev/null || true
xattr -cr "$DIR"/../"Dead Again - Revamped (Twitch Edition).app" 2>/dev/null || true
xattr -cr "$DIR"/../"Dead Again.app" 2>/dev/null || true

echo ""
echo "=================================================================="
echo "Gatekeeper quarantine cleared!"
echo "You can now launch Dead Again - Revamped (Twitch Edition) normally."
echo "=================================================================="
echo ""
read -n 1 -s -r -p "Press any key to close this terminal window..."
echo ""
exit 0
