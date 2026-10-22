# BioSentry — Design Prompts

App name: **BioSentry**
Tagline: *Your biofilter, watched in real time.*

---

## 1. Design prompt — App UI

```
Design the full mobile UI for "BioSentry", an Android app (portrait, 360–412dp wide) that connects over local Wi-Fi to an ESP32 microcontroller and shows live readings, graphs and alerts from 4 sensors installed around a biofilter drum system.

PURPOSE & FEEL
- A calm, trustworthy monitoring tool, used outdoors / in a utility area, often glanced at quickly.
- Modern, clean and data-first, like a premium smart-home or IoT dashboard. Avoid clutter.
- Provide BOTH a dark theme (primary) and a light theme.
- Brand colour direction: deep teal / bio-green as the primary (water + biology), with clear semantic status colours: Safe (green), Warning (amber), Danger (red), Info (blue), Offline (grey).
- Large, readable numbers. Every status must be readable without relying on colour alone (use icon + text label too).

THE 4 SENSORS (use these exact names, units and ranges)
1. Rain Sensor (conductive rain module)
   - Value: Wetness 0–100 %  + digital state "Dry" / "Raining"
   - Status: Dry (<20%), Damp (20–60%), Raining (>60%)
2. Biofilter Water Quality (Gravity Analog TDS sensor in the biofilter drum)
   - Value: TDS in ppm (0–1000 typical), plus water temperature °C (optional)
   - Status: Good (<300 ppm), Fair (300–600), Poor (>600)
3. Gas / Smoke Sensor (MQ-2 smoke & flammable gas)
   - Value: Gas level 0–100 % (relative), raw ADC 0–4095 shown small
   - Status: Normal (<35%), Elevated (35–60%), DANGER (>60%) — danger must be very prominent
4. Motion Sensor (HC-SR501 PIR)
   - Value: Motion "Detected" / "Clear", time of last motion, number of motion events today
   - Chart is an event timeline / step chart, not a smooth line

SCREENS TO DESIGN
1. Splash screen — logo centred on brand background.
2. Connect / Onboarding
   - Explains: "Connect your phone to the same Wi-Fi as your ESP32, then enter its IP address".
   - Text field for IP address (e.g. 192.168.1.50) with port, "Test connection" button, connection result state (success / failed with a helpful hint).
   - Secondary option: "Try Demo Mode" (simulated data, no hardware needed).
   - A tip for direct hotspot mode: "Joined the BioSentry-Setup Wi-Fi? Use 192.168.4.1".
3. Dashboard (home)
   - Top bar: app name, connection pill (Live • 192.168.1.50 / Reconnecting… / Offline / Demo), last updated "2s ago".
   - Overall system status banner (e.g. "All systems normal" or "Gas level dangerous!").
   - 4 sensor cards in a 2x2 grid or stacked list: icon, sensor name, big current value + unit, status chip, and a tiny sparkline of the last few minutes. Tap → detail.
   - Pull-to-refresh.
4. Sensor Detail (one template, shown for all 4 sensors)
   - Big current value with status, min / max / average for the selected range.
   - Large interactive line chart (tap/drag to see a tooltip with value + time), threshold lines drawn on the chart (e.g. warning and danger lines).
   - Time range segmented control: 1 min · 5 min · 15 min · 1 hour.
   - "About this sensor" info section (what it measures, where it is mounted, wiring pin).
   - Motion sensor variant: event timeline + list of recent motion events.
5. Alerts / Activity
   - Chronological list of events: "Gas level reached 72% — Danger", "Rain started", "Motion detected", "ESP32 disconnected". Each has an icon, severity colour, time.
   - Filter chips: All · Danger · Warning · Info. "Clear all" action.
6. Settings
   - ESP32 address (IP + port) with Edit and Test.
   - Refresh interval (1s, 2s, 5s, 10s).
   - Alert thresholds per sensor (sliders): rain %, TDS ppm warning/poor, gas % elevated/danger.
   - Toggles: Demo mode, Vibrate on danger, Keep screen awake.
   - Theme: System / Dark / Light.
   - About: app version, device info returned from ESP32 (firmware version, uptime, Wi-Fi signal strength in dBm).
7. Empty / error states
   - Can't reach ESP32 (with troubleshooting tips), no data yet (skeleton loaders), sensor not connected / reading invalid.

NAVIGATION
- Bottom navigation with 3 tabs: Dashboard · Alerts · Settings. Sensor Detail opens as a pushed screen from Dashboard.
- Connect screen appears on first launch and when no address is saved.

COMPONENTS (please show them as a small component sheet too)
- Sensor card, status chip, connection pill, segmented range control, line chart with threshold lines and tooltip, sparkline, alert list item, settings row, slider row, toggle row, primary/secondary buttons, text input, banner (info/warning/danger), skeleton loader.

TECHNICAL CONSTRAINTS (it will be built in React Native / Expo)
- Use a single Google Font family available in @expo-google-fonts (e.g. Inter, Manrope, Plus Jakarta Sans or Space Grotesk) — with tabular/monospaced numbers for live values.
- Use icons that exist in Material Symbols / Material Community Icons (e.g. weather-rainy, water-check, molecule / smoke-detector-variant, motion-sensor, wifi, alert) so they can be reproduced exactly.
- Respect Android status bar and gesture-navigation safe areas. Touch targets ≥ 48dp.
- Shadows should be subtle (elevation 1–4); prefer rounded corners (12–20dp) and soft surfaces.

DELIVERABLES
- All screens above in dark theme, plus Dashboard, Sensor Detail and Settings in light theme.
- Example data states: everything normal; gas DANGER + raining; ESP32 offline.
- A design-tokens summary I can hand to a developer: colour palette with hex values for both themes (background, surface, surface-elevated, primary, text primary/secondary, border, safe/warning/danger/info/offline), font family + type scale (sizes / weights / line heights), spacing scale, corner radii, elevation.
```

---

## 2. Design prompt — Logo / App Icon

```
Design a logo and Android app icon for "BioSentry", a mobile app that monitors a biofilter drum system through an ESP32 over Wi-Fi. It watches four things: rain, water quality (TDS) in the biofilter, smoke/flammable gas, and motion.

CONCEPT DIRECTION
- Combine nature + technology + protection. Ideas to explore (show 3 different concepts):
  a) A water droplet or leaf whose inner shape forms a shield, with a small signal / Wi-Fi arc.
  b) A stylised circular drum (top-down view) with radiating "sensor pulse" rings — 4 subtle segments for the 4 sensors.
  c) A monogram "B" / "BS" built from a droplet and a pulse/heartbeat line.
- Must feel modern, minimal, geometric and friendly — not clip-art, no photorealism, no tiny details.
- Must still be recognisable at 48×48 px and as a single-colour silhouette.

COLOURS
- Primary: deep teal / bio-green (around #0F766E → #14B8A6 range), with an optional fresh accent (lime #A3E635 or aqua #22D3EE).
- Should look good on both a dark (#0B1416) and a white background.
- Flat colours or one subtle gradient at most.

DELIVERABLES (please export exactly these, PNG unless stated)
1. icon.png — 1024×1024, full square app icon, no transparency, no rounded corners (the OS masks it).
2. android-icon-foreground.png — 1024×1024, TRANSPARENT background, symbol only. Keep the important artwork inside the central 66% circle (≈ 676 px diameter), since Android adaptive icons crop to circles / squircles and animate the edges.
3. android-icon-background.png — 1024×1024, solid colour or very soft gradient that pairs with the foreground.
4. android-icon-monochrome.png — 1024×1024, transparent background, symbol in pure white only (used for Android 13+ themed icons), same safe zone as the foreground.
5. splash-icon.png — 1024×1024 transparent, symbol only (it is shown centred on a solid splash background colour — tell me that hex colour).
6. A horizontal wordmark lockup: symbol + "BioSentry" text (SVG + PNG, light and dark versions).
7. favicon.png — 48×48.

Also tell me: the font used for the wordmark and the exact hex codes of every colour in the logo.
```
