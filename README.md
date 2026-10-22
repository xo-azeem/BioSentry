# BioSentry

Android app (Expo / React Native) that connects to an **ESP32 over Wi-Fi** and shows live values, graphs and alerts for the biofilter system. The UI follows the **"BioSentry Design"** design file: Space Grotesk, Material Symbols Rounded, and the dark and light token sets.

| Sensor | Module | Shown as |
|---|---|---|
| Rain | FC-37 / YL-83 conductive rain module | Wetness % · Dry / Damp / Raining |
| Biofilter water quality | Gravity Analog **TDS** sensor (+ optional DS18B20) | TDS ppm · Good / Fair / Poor |
| Gas / smoke | MQ-2 | Relative level % · Normal / Elevated / DANGER |
| Motion | HC-SR501 PIR | Detected / Clear · event timeline with durations |

**Screens:**
- **Splash**
- **Connect:** address validation, test, hotspot shortcut, demo mode
- **Dashboard:** grid or list layout, banner, connection pill, pull to refresh, loading skeletons, "Can't reach ESP32" troubleshooting, offline last-known values, invalid-sensor state
- **Sensor detail:** 1 min / 5 min / 15 min / 1 hour chart that you can drag to inspect, threshold lines, min/avg/max, motion timeline and recent events
- **Alerts:** grouped by day, filters, badge, clear all
- **Settings:** connection test, refresh interval, threshold sliders, demo mode, vibrate on danger, keep the screen awake, theme, dashboard layout, device info

```
sensor-app/
├─ src/app/             screens (Expo Router)
├─ src/components/      design-system pieces: Text, Icon, chips, cards, charts, tab bar, splash
├─ src/lib/             data store, ESP32 API, demo data, sensor rules, alerts, theme tokens
├─ assets/              app icon, adaptive icon, splash and in-app logo (made from logo.jpg); fonts
├─ firmware/BioSentry/  ESP32 Arduino sketch
├─ tools/mock-esp32.js  fake ESP32 for testing without hardware
└─ __tests__/           unit + end-to-end tests
```

---

## 1. Flash the ESP32

1. Install **Arduino IDE 2**. In *Boards Manager*, install **"esp32 by Espressif Systems"**.
2. Open `firmware/BioSentry/BioSentry.ino`, then set `WIFI_SSID` and `WIFI_PASSWORD` (2.4 GHz Wi-Fi only).
3. Board: **ESP32 Dev Module**. Upload.
4. Open the **Serial Monitor at 115200 baud**. It prints `Enter this IP in the app: 192.168.x.x`.

Wiring:

| Sensor pin | ESP32 |
|---|---|
| Rain AO / DO | GPIO 35 / GPIO 27 |
| TDS signal (A) | GPIO 34 |
| MQ-2 AO (through a 10k/20k voltage divider) / DO | GPIO 32 / GPIO 26 |
| PIR OUT | GPIO 14 |
| DS18B20 water temperature (optional, 4.7k pull-up) | GPIO 4 |
| Rain, TDS VCC | 3.3V |
| MQ-2, PIR VCC | 5V (VIN) |

> ⚠️ **MQ-2 outputs up to 5V.** Feeding that straight into the ESP32 can damage it, so use the divider drawn in the sketch. The MQ-2 needs about 2 minutes of warm-up.
>
> **Water temperature is optional.** Without a DS18B20 the app shows the probe voltage instead, and TDS is compensated as if the water were at 25 °C. To use one, install the *OneWire* and *DallasTemperature* libraries and set `#define USE_DS18B20 1`.

If the ESP32 can't join your Wi-Fi, it starts its own hotspot, **BioSentry-Setup** (password `biosentry123`). Join it and tap **Use** on the Connect screen to fill in **192.168.4.1**.

The ESP32 serves:
- `GET /api/sensors`: live readings
- `GET /api/history`: the last hour in 5-second samples plus the last 50 motion events, so graphs are full as soon as the app connects

---

## 2. Run the app during development (Expo Go)

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on Android. To explore without hardware, choose **Try Demo Mode**.

To test the real Wi-Fi path without an ESP32, run the fake one on your PC and enter the PC's IP with port **8080**:

```bash
npm run mock                         # normal readings
npm run mock -- --scenario danger    # gas DANGER + raining
npm run mock -- --scenario invalid   # TDS probe reports an invalid reading
```

Press Ctrl+C on the mock to see the app's *Offline* or *Can't reach* states.

---

## 3. Build a standalone APK (no QR code or PC needed afterwards)

**Option A: Expo cloud build (easiest)**

```bash
npx eas-cli@latest login            # free account at expo.dev
npx eas-cli@latest build:configure  # first time only
npm run build:apk                   # = eas build -p android --profile preview
```

After about 10–15 minutes you get a download link for the APK. Open it on the phone, allow "install unknown apps", and install. The app then runs on its own.

**Option B: build on this PC** (needs Android Studio's SDK and JDK 17)

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Notes:
- The phone and the ESP32 must be on the **same Wi-Fi** (or the phone joined to the ESP32's hotspot).
- Plain `http://` to the ESP32 is allowed in release builds (`usesCleartextTraffic` in `app.json`).
- Reserve the ESP32's IP in your router (DHCP reservation) so the address never changes.

---

## 4. Tests

```bash
npm test            # 40 tests: parsing, status rules, alerts, charts, plus end-to-end UI flows against a fake ESP32
npx tsc --noEmit    # typecheck
```
