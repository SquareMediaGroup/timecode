#!/bin/sh
set -e

echo "Running Timecode OS post-build script..."

# Create target directory for our app
APP_TARGET_DIR="${TARGET_DIR}/opt/timecode"
mkdir -p "$APP_TARGET_DIR"

# Copy backend and frontend into rootfs
echo "Copying backend..."
cp -r "${BR2_EXTERNAL_TIMECODE_OS_PATH}/../../backend" "$APP_TARGET_DIR/"
echo "Copying frontend..."
cp -r "${BR2_EXTERNAL_TIMECODE_OS_PATH}/../../frontend" "$APP_TARGET_DIR/"

# Create symlinks to enable our systemd services on boot
WANTS_DIR="${TARGET_DIR}/etc/systemd/system/multi-user.target.wants"
mkdir -p "$WANTS_DIR"

ln -sf ../timecode.service "${WANTS_DIR}/timecode.service"
ln -sf ../wifi-powersave-off.service "${WANTS_DIR}/wifi-powersave-off.service"
ln -sf /usr/lib/systemd/system/wpa_supplicant@.service "${WANTS_DIR}/wpa_supplicant@wlan0.service"

echo "Post-build script complete."
