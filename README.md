# Timecode OS

Timecode OS is a highly optimized, dedicated Raspberry Pi 4 appliance designed for live production environments. It acts as the central "Trigger Brain" for a show, providing a master SMPTE timecode clock and firing frame-accurate commands to industry-standard lighting, video, and audio consoles.

## 🚀 Key Features

### ⏱️ Dual Timecode Engine
*   **Internal Clock Mode:** Generate precise 24, 25, 29.97 (Drop Frame), or 30 FPS timecode directly from the appliance with full transport controls (Play, Pause, Stop). Perfect for running automated pre-shows and walk-in cues.
*   **MTC Sync Mode (rtpMIDI):** Listen to external MIDI Timecode over Wi-Fi or Ethernet (e.g., from MultiTracks Playback on an iPad) via AppleMIDI (Network MIDI).
*   **PLL Jitter Filter:** Features a custom mathematical Phase-Locked Loop (PLL) filter that smooths out network latency and Wi-Fi packet dropouts when ingesting wireless timecode, ensuring your lighting hits perfectly on the beat even on congested networks.

### 🎛️ Multi-Protocol Device Integration
Timecode OS natively translates timecode triggers into the native protocols of your production gear:
*   **Avolites Titan:** Trigger lighting scenes and macros via OSC (Open Sound Control) or Art-Net.
*   **ProPresenter 7:** Trigger lyrics, slides, and videos via the ProPresenter WebSocket API.
*   **Blackmagic ATEM:** Trigger video macros and transitions via UDP.
*   **Allen & Heath GLD:** Trigger audio scenes via TCP MIDI.

### 💻 Modern Web Dashboard (`timecode.local`)
The system hosts a responsive React web app accessible from any laptop or tablet on your network.
*   **Zero Config:** Access it instantly at `http://timecode.local` using mDNS.
*   **Show Mode:** A massive, high-visibility clock (using the JetBrains Mono font) designed to be readable from across the tech booth.
*   **Programming Mode:** A centralized, visual Cue Editor. Easily map specific timecode frames to lighting and video actions without dealing with messy MIDI notes.
*   **Live Settings:** Configure target IP addresses and toggle Dark/Light mode on the fly.

### 🐧 Dedicated Embedded OS
This repository isn't just software; it includes the configuration to build a bespoke Linux Operating System.
*   **Buildroot Driven:** The OS is stripped of all desktop bloat, resulting in lightning-fast boot times and maximum stability.
*   **Appliance Ready:** The Node.js backend runs automatically on boot as a systemd service.
*   **Network Optimized:** Features automated DHCP for hardwired Ethernet (`eth0`) to guarantee an IP address the second you plug it into a UniFi switch.

---

## 🛠️ Architecture

*   **Backend:** Node.js (ES Modules), Express, Socket.IO, `lowdb` (for JSON cue persistence), `rtpmidi`.
*   **Frontend:** React, TypeScript, Vite, Socket.IO Client.
*   **OS Build:** Buildroot 2024.02, `raspberrypi4_64` architecture, Linux Kernel 6.1.x.

## 📦 Building the OS Image

This repository uses **GitHub Actions** to automatically compile the custom OS image in the cloud.

1. Navigate to the **[Actions](../../actions)** tab in this repository.
2. Click on the latest successful **"Build Timecode OS"** run.
3. Scroll to the bottom and download the `timecode-os-sdcard.zip` artifact.
4. Extract the zip and flash the `.img` file to your Raspberry Pi SD card using [BalenaEtcher](https://etcher.balena.io/) or Raspberry Pi Imager.
5. Plug it into your network and boot it up!

*(Local compilation via Docker/OrbStack coming in V1.2)*
