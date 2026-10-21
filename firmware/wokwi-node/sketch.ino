#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- TUS CREDENCIALES DE WI-FI ---
const char* ssid = "Yak-3";
const char* password = "sbgs8189";

// --- BACKEND (URL del túnel Cloudflare, con la ruta completa) ---
// ---- cloudflared tunnel --url http://localhost:80 + "URL/api/sensors/ingest
const char* INGEST_URL = "https://subscribers-vic-wins-wesley.trycloudflare.com/api/sensors/ingest   ";
const char* SENSOR_ID  = "sensor_zone_1";
const unsigned long SEND_INTERVAL_MS = 30000;   // envío cada 30 s
unsigned long lastSend = 0;

// --- ASIGNACIÓN DE PINES ---
#define ONE_WIRE_BUS 4          // Pin del sensor DS18B20 (GPIO 4)
#define MOISTURE_PIN 34         // Pin del sensor capacitivo de humedad (GPIO 34 / A2)

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// Calibración del sensor de humedad
const int valorSeco = 3100;
const int valorHumedo = 1100;

void conectarWiFi() {
  Serial.print("Conectando a ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n¡Conectado a la red Wi-Fi!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI (Señal): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\nNo se pudo conectar al Wi-Fi");
  }
}

// Envía la lectura al backend. Devuelve el código HTTP (o <0 si falló).
int enviarLectura(float tempC, int porcentajeHumedad, int valorHumedadRaw) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  char body[200];
  snprintf(body, sizeof(body),
    "{\"sensor_id\":\"%s\",\"humidity\":%d,\"temperature\":%.1f,\"raw_adc\":%d,\"rssi\":%d,\"uptime_s\":%lu}",
    SENSOR_ID, porcentajeHumedad, tempC, valorHumedadRaw, WiFi.RSSI(), millis() / 1000);

  Serial.print(" POST -> ");
  Serial.println(body);

  WiFiClientSecure client;
  client.setInsecure();            // sin validar certificado (suficiente para pruebas)
  HTTPClient http;
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  int code = -1;
  if (http.begin(client, INGEST_URL)) {
    http.addHeader("Content-Type", "application/json");
    code = http.POST(body);
    if (code > 0) {
      Serial.print(" HTTP ");
      Serial.print(code);
      Serial.print(" -> ");
      Serial.println(http.getString());
    } else {
      Serial.print(" Error HTTP: ");
      Serial.println(HTTPClient::errorToString(code));
    }
    http.end();
  }
  return code;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Inicializar sensores
  sensors.begin();
  pinMode(MOISTURE_PIN, INPUT);

  // Conectar a internet
  conectarWiFi();
}

void loop() {
  // 1. Verificar y mantener la conexión Wi-Fi (Reconexión automática)
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdido, reconectando...");
    conectarWiFi();
  }

  // 2. Lectura de Temperatura del Entorno (DS18B20)
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);

  // 3. Lectura de Humedad del Suelo
  int valorHumedadRaw = analogRead(MOISTURE_PIN);
  int porcentajeHumedad = map(valorHumedadRaw, valorSeco, valorHumedo, 0, 100);
  porcentajeHumedad = constrain(porcentajeHumedad, 0, 100);

  // 4. Mostrar todos los datos en el Monitor Serial
  Serial.println("------------------------------------------");

  bool tempOk = (tempC != DEVICE_DISCONNECTED_C);
  if (!tempOk) {
    Serial.println(" Error: No se detecta el sensor DS18B20.");
  } else {
    Serial.print(" Temperatura Entorno: ");
    Serial.print(tempC);
    Serial.println(" °C");
  }

  Serial.print(" Humedad del Suelo: ");
  Serial.print(porcentajeHumedad);
  Serial.print(" %  (Valor crudo: ");
  Serial.print(valorHumedadRaw);
  Serial.println(")");

  Serial.println(" Estado Wi-Fi: Conectado (IP: " + WiFi.localIP().toString() + ")");

  // 5. Enviar al dashboard cada 30 s (solo si el DS18B20 lee bien)
  if (tempOk && (lastSend == 0 || millis() - lastSend >= SEND_INTERVAL_MS)) {
    lastSend = millis();
    enviarLectura(tempC, porcentajeHumedad, valorHumedadRaw);
  }

  // Esperar 5 segundos antes de la siguiente lectura
  delay(5000);
}