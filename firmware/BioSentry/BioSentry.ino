/*
  BioSentry — ESP32 firmware  (v1.1.0)
  ---------------------------------------------------------------
  Reads 4 sensors and serves them as JSON over Wi-Fi for the BioSentry Android app.

    GET http://<esp32-ip>/api/sensors   -> live readings
    GET http://<esp32-ip>/api/history   -> last hour (5 s samples) + recent motion events
    GET http://<esp32-ip>/              -> small status page

  Board:   any ESP32 dev board (ESP32-WROOM-32 / DevKit V1)
  Arduino: "esp32 by Espressif Systems" board package (Boards Manager). No extra libraries needed
           unless you enable the optional DS18B20 water-temperature probe below.

  Wiring (ADC1 pins only — ADC2 pins do not work while Wi-Fi is on):
    Rain module (FC-37/YL-83)  AO -> GPIO35   DO -> GPIO27   VCC -> 3.3V  GND -> GND
    TDS (Gravity Analog)       A  -> GPIO34                  +   -> 3.3V  -   -> GND
    MQ-2 gas / smoke           AO -> divider -> GPIO32       VCC -> 5V    GND -> GND
                               DO -> GPIO26 (optional)
                               !! MQ-2 runs on 5V and its AO can reach 5V. Use a divider:
                                  AO --[10k]--+--> GPIO32
                                              |
                                            [20k]
                                              |
                                             GND
    PIR HC-SR501               OUT -> GPIO14                 VCC -> 5V    GND -> GND  (OUT is 3.3V, safe)
    DS18B20 (optional)         DATA -> GPIO4 (+4.7k pull-up to 3.3V)

  If the Wi-Fi below can't be joined within 15 s, the ESP32 starts its own hotspot:
    SSID "BioSentry-Setup", password "biosentry123", app address 192.168.4.1
*/

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>

// ---------- EDIT THESE ----------
const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// Set to 1 if you add a DS18B20 probe (install "OneWire" + "DallasTemperature" libraries first).
#define USE_DS18B20 0
// --------------------------------

#if USE_DS18B20
#include <OneWire.h>
#include <DallasTemperature.h>
#endif

const char *AP_SSID = "BioSentry-Setup";
const char *AP_PASSWORD = "biosentry123";  // min 8 chars
const char *FW_VERSION = "1.1.0";

// Pins (match the app's "About this sensor" screens)
const int PIN_RAIN_AO = 35;
const int PIN_RAIN_DO = 27;
const int PIN_TDS = 34;
const int PIN_GAS_AO = 32;
const int PIN_GAS_DO = 26;
const int PIN_PIR = 14;
const int PIN_DS18B20 = 4;

// TDS settings
const float TDS_VREF = 3.3;  // ADC reference voltage
const int TDS_SAMPLES = 30;

// History: one sample every 5 s for an hour, plus the last 50 motion events.
const int HIST_STEP_S = 5;
const int HIST_LEN = 720;
const int MAX_EVENTS = 50;

WebServer server(80);
bool apMode = false;

#if USE_DS18B20
OneWire oneWire(PIN_DS18B20);
DallasTemperature tempSensor(&oneWire);
#endif

// Latest values
int rainRaw = 4095, gasRaw = 0, tdsRaw = 0;
float rainPercent = 0, gasPercent = 0, tdsVoltage = 0, tdsPpm = 0;
float waterTemp = NAN;
bool raining = false, gasAlarm = false;
bool rainOk = true, tdsOk = true, gasOk = true;
bool motion = false;
unsigned long motionCount = 0;
unsigned long lastMotionMs = 0;
bool everMotion = false;

int tdsBuffer[TDS_SAMPLES];
int tdsIndex = 0;

// Ring buffers
uint8_t histRain[HIST_LEN], histGas[HIST_LEN], histMotion[HIST_LEN];
uint16_t histTds[HIST_LEN];
int histHead = 0, histCount = 0;
unsigned long lastHistMs = 0;
bool motionSinceLastSample = false;

unsigned long evStart[MAX_EVENTS], evEnd[MAX_EVENTS];  // evEnd = 0 while ongoing
int evHead = 0, evCount = 0;

int averageAnalog(int pin, int samples = 16) {
  long sum = 0;
  for (int i = 0; i < samples; i++) sum += analogRead(pin);
  return sum / samples;
}

int medianOf(int *arr, int n) {
  int tmp[TDS_SAMPLES];
  memcpy(tmp, arr, n * sizeof(int));
  for (int i = 0; i < n - 1; i++)
    for (int j = 0; j < n - i - 1; j++)
      if (tmp[j] > tmp[j + 1]) { int t = tmp[j]; tmp[j] = tmp[j + 1]; tmp[j + 1] = t; }
  return (n & 1) ? tmp[n / 2] : (tmp[n / 2] + tmp[n / 2 - 1]) / 2;
}

void readSensors() {
  // Rain: the module reads ~4095 when dry and drops as it gets wet.
  rainRaw = averageAnalog(PIN_RAIN_AO);
  rainPercent = constrain((4095 - rainRaw) * 100.0 / 4095.0, 0, 100);
  raining = digitalRead(PIN_RAIN_DO) == LOW;  // DO goes LOW when wet (pot sets sensitivity)
  rainOk = true;

  // MQ-2: higher voltage = more gas/smoke.
  gasRaw = averageAnalog(PIN_GAS_AO);
  gasPercent = constrain(gasRaw * 100.0 / 4095.0, 0, 100);
  gasAlarm = digitalRead(PIN_GAS_DO) == LOW;  // DO goes LOW above the pot threshold
  gasOk = true;

#if USE_DS18B20
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  waterTemp = (t == DEVICE_DISCONNECTED_C) ? NAN : t;
#endif

  // TDS: median-filtered, temperature compensated (DFRobot formula).
  tdsRaw = medianOf(tdsBuffer, TDS_SAMPLES);
  tdsVoltage = tdsRaw * TDS_VREF / 4095.0;
  float temp = isnan(waterTemp) ? 25.0 : waterTemp;
  float v = tdsVoltage / (1.0 + 0.02 * (temp - 25.0));
  tdsPpm = (133.42 * v * v * v - 255.86 * v * v + 857.39 * v) * 0.5;
  if (tdsPpm < 0) tdsPpm = 0;
  // A saturated ADC means a wiring fault (signal shorted to 3.3 V or probe board unpowered/floating high).
  tdsOk = tdsRaw < 4090;
}

void samplePir() {
  bool now = digitalRead(PIN_PIR) == HIGH;
  unsigned long ms = millis();
  if (now && !motion) {
    motionCount++;
    everMotion = true;
    evStart[evHead] = ms;
    evEnd[evHead] = 0;
    evHead = (evHead + 1) % MAX_EVENTS;
    if (evCount < MAX_EVENTS) evCount++;
  }
  if (!now && motion && evCount > 0) {
    int last = (evHead - 1 + MAX_EVENTS) % MAX_EVENTS;
    evEnd[last] = ms;
  }
  if (now) {
    lastMotionMs = ms;
    motionSinceLastSample = true;
  }
  motion = now;
}

void recordHistory() {
  histRain[histHead] = (uint8_t)round(rainPercent);
  histGas[histHead] = (uint8_t)round(gasPercent);
  histTds[histHead] = tdsOk ? (uint16_t)round(tdsPpm) : 0xFFFF;  // 0xFFFF = invalid sample
  histMotion[histHead] = (motion || motionSinceLastSample) ? 1 : 0;
  motionSinceLastSample = false;
  histHead = (histHead + 1) % HIST_LEN;
  if (histCount < HIST_LEN) histCount++;
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-store");
}

void handleSensors() {
  long lastSeconds = everMotion ? (long)((millis() - lastMotionMs) / 1000) : -1;
  String ip = apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
  String rssi = apMode ? "null" : String(WiFi.RSSI());
  String temp = isnan(waterTemp) ? "null" : String(waterTemp, 1);

  char buf[768];
  snprintf(buf, sizeof(buf),
           "{\"device\":\"BioSentry-ESP32\",\"fw\":\"%s\",\"board\":\"%s\",\"uptime\":%lu,\"rssi\":%s,\"ip\":\"%s\","
           "\"rain\":{\"raw\":%d,\"percent\":%.1f,\"raining\":%s,\"ok\":%s},"
           "\"tds\":{\"raw\":%d,\"voltage\":%.3f,\"ppm\":%.1f,\"temp\":%s,\"ok\":%s},"
           "\"gas\":{\"raw\":%d,\"percent\":%.1f,\"alarm\":%s,\"ok\":%s},"
           "\"motion\":{\"detected\":%s,\"count\":%lu,\"lastSeconds\":%ld}}",
           FW_VERSION, ESP.getChipModel(), millis() / 1000, rssi.c_str(), ip.c_str(),
           rainRaw, rainPercent, raining ? "true" : "false", rainOk ? "true" : "false",
           tdsRaw, tdsVoltage, tdsPpm, temp.c_str(), tdsOk ? "true" : "false",
           gasRaw, gasPercent, gasAlarm ? "true" : "false", gasOk ? "true" : "false",
           motion ? "true" : "false", motionCount, lastSeconds);

  sendCors();
  server.send(200, "application/json", buf);
}

void handleHistory() {
  unsigned long now = millis();
  String out;
  out.reserve(histCount * 16 + MAX_EVENTS * 16 + 128);
  out += "{\"step\":" + String(HIST_STEP_S) + ",\"age\":" + String((now - lastHistMs) / 1000);
  const char *names[] = {"rain", "tds", "gas", "motion"};
  for (int k = 0; k < 4; k++) {
    out += ",\"";
    out += names[k];
    out += "\":[";
    for (int i = 0; i < histCount; i++) {
      int idx = (histHead - histCount + i + HIST_LEN) % HIST_LEN;
      if (i) out += ',';
      if (k == 0) out += histRain[idx];
      else if (k == 1) out += histTds[idx] == 0xFFFF ? String("null") : String(histTds[idx]);
      else if (k == 2) out += histGas[idx];
      else out += histMotion[idx];
    }
    out += ']';
  }
  // Events newest first: [secondsAgo, durationSeconds or -1 while ongoing]
  out += ",\"events\":[";
  for (int i = 0; i < evCount; i++) {
    int idx = (evHead - 1 - i + MAX_EVENTS) % MAX_EVENTS;
    if (i) out += ',';
    out += '[';
    out += (now - evStart[idx]) / 1000;
    out += ',';
    out += evEnd[idx] ? String((long)((evEnd[idx] - evStart[idx]) / 1000)) : String(-1);
    out += ']';
  }
  out += "]}";
  sendCors();
  server.send(200, "application/json", out);
}

void handleRoot() {
  sendCors();
  server.send(200, "text/html",
              "<html><body style='font-family:sans-serif'><h2>BioSentry ESP32</h2>"
              "<p>Running. Live data: <a href='/api/sensors'>/api/sensors</a> · "
              "History: <a href='/api/history'>/api/history</a></p></body></html>");
}

void startWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi \"%s\"", WIFI_SSID);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("==========================================");
    Serial.print("  Connected! Enter this IP in the app: ");
    Serial.println(WiFi.localIP());
    Serial.println("==========================================");
    if (MDNS.begin("biosentry")) MDNS.addService("http", "tcp", 80);
  } else {
    apMode = true;
    WiFi.disconnect(true);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASSWORD);
    Serial.println("==========================================");
    Serial.println("  Wi-Fi failed -> hotspot mode");
    Serial.printf("  Join \"%s\" (password %s)\n", AP_SSID, AP_PASSWORD);
    Serial.print("  Then enter this IP in the app: ");
    Serial.println(WiFi.softAPIP());
    Serial.println("==========================================");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);      // 0 – ~3.3 V input range
  pinMode(PIN_RAIN_DO, INPUT_PULLUP);  // pull-ups keep unwired DO pins reading "dry / no alarm"
  pinMode(PIN_GAS_DO, INPUT_PULLUP);
  pinMode(PIN_PIR, INPUT);

#if USE_DS18B20
  tempSensor.begin();
  tempSensor.setWaitForConversion(false);  // never block the web server; we read the previous conversion
#endif

  for (int i = 0; i < TDS_SAMPLES; i++) tdsBuffer[i] = analogRead(PIN_TDS);
  readSensors();

  startWifi();

  server.on("/", handleRoot);
  server.on("/api/sensors", handleSensors);
  server.on("/api/history", handleHistory);
  server.onNotFound([]() { sendCors(); server.send(404, "application/json", "{\"error\":\"not found\"}"); });
  server.begin();

  Serial.println("MQ-2 needs about 2 minutes to warm up before gas readings are stable.");
}

unsigned long lastTdsSample = 0;
unsigned long lastRead = 0;
unsigned long lastLog = 0;

void loop() {
  server.handleClient();
  samplePir();

  unsigned long now = millis();
  if (now - lastTdsSample >= 40) {
    lastTdsSample = now;
    tdsBuffer[tdsIndex] = analogRead(PIN_TDS);
    tdsIndex = (tdsIndex + 1) % TDS_SAMPLES;
  }
  if (now - lastRead >= 500) {
    lastRead = now;
    readSensors();
  }
  if (now - lastHistMs >= HIST_STEP_S * 1000UL) {
    lastHistMs = now;
    recordHistory();
  }
  if (now - lastLog >= 5000) {
    lastLog = now;
    Serial.printf("[%s] rain %.0f%% | tds %.0f ppm%s | gas %.0f%% | motion %s\n",
                  apMode ? WiFi.softAPIP().toString().c_str() : WiFi.localIP().toString().c_str(),
                  rainPercent, tdsPpm, tdsOk ? "" : " (INVALID)", gasPercent, motion ? "YES" : "no");
  }
}
