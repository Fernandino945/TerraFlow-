#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

//raw_adc
// ====== CONFIGURACIÓN ======
const char* WIFI_SSID    = "Wokwi-GUEST";
const char* WIFI_PASS    = "";
const int   WIFI_CHANNEL = 6;
const char* INGEST_URL   = "http://remembered-shield-hepatitis-industrial.trycloudflare.com/api/sensors/ingest";
const char* SENSOR_ID    = "sensor_zone_1";

const int PIN_SOIL = 34;   // ADC1. En el Heltec V3 se cambia en HU-19
const int PIN_DS18 = 4;

// Calibración capacitivo: más raw = más seco
const int RAW_DRY = 4095;  // aire  -> 0 %
const int RAW_WET = 0;     // agua  -> 100 %

const unsigned long SEND_INTERVAL_MS = 30000;  // igual al ciclo del scheduler (30 s)

OneWire oneWire(PIN_DS18);
DallasTemperature ds18(&oneWire);
unsigned long lastSend = 0;

int readSoilRaw() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(PIN_SOIL); delay(5); }
  return sum / 10;
}

float rawToPercent(int raw) {
  float pct = (float)(RAW_DRY - raw) * 100.0 / (float)(RAW_DRY - RAW_WET);
  return constrain(pct, 0.0, 100.0);
}

void connectWifi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS, WIFI_CHANNEL);
  Serial.print("Conectando WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.println(" OK");
}

void sendReading() {
  ds18.requestTemperatures();
  float temp = ds18.getTempCByIndex(0);
  if (temp == DEVICE_DISCONNECTED_C) {
    Serial.println("DS18B20 desconectado, lectura omitida");
    return;
  }

  int raw = readSoilRaw();
  float hum = rawToPercent(raw);

  char body[200];
  snprintf(body, sizeof(body),
    "{\"sensor_id\":\"%s\",\"humidity\":%.1f,\"temperature\":%.1f,"
    "\"raw_adc\":%d,\"rssi\":%d,\"uptime_s\":%lu}",
    SENSOR_ID, hum, temp, raw, WiFi.RSSI(), millis() / 1000UL);

  Serial.print("POST -> "); Serial.println(body);

  WiFiClient client;
  
  HTTPClient http;
  http.setConnectTimeout(20000);
  http.setTimeout(20000);
  http.begin(client, INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  int code = -1;
for (int attempt = 1; attempt <= 3 && code < 0; attempt++) {
  code = http.POST(body);
  if (code < 0) {
    Serial.print("Reintento "); Serial.println(attempt);
    http.end();
    delay(1500 * attempt);
    if (WiFi.status() != WL_CONNECTED) connectWifi();
    if (attempt < 3) {
      http.begin(client, INGEST_URL);
      http.addHeader("Content-Type", "application/json");
    }
  }
}
  Serial.print("HTTP "); Serial.println(code);
  if (code > 0) Serial.println(http.getString());
  http.end();
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  ds18.begin();
  connectWifi();
  sendReading();
  lastSend = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendReading();
  }
}