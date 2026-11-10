#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Preferences.h>

// --- CREDENCIALES DE WI-FI (completar; NO subir a Git con valores reales) ---
const char* ssid = "Yak-3";
const char* password = "sbgs8189";

// --- BACKEND (URL del túnel Cloudflare, con la ruta completa) ---
// cloudflared tunnel --url http://localhost:80
const char* INGEST_URL    = "https://sectional-thumb-concerned.ngrok-free.dev/api/sensors/ingest";
const char* HEARTBEAT_URL = "https://sectional-thumb-concerned.ngrok-free.dev/api/sensors/gateway/heartbeat";
const char* SENSOR_ID     = "sensor_zone_1";
// --- VÁLVULA (relé activo en bajo) ---
const uint8_t VALVE_PIN = 26;                                  // IN1 del módulo de relé
const unsigned long COMM_TIMEOUT_MS = 60000;                   // HU-26: sin heartbeat válido por 60 s
const unsigned long MAX_IRRIGATION_MS = 30UL * 60UL * 1000UL;  // HU-26: tiempo máximo de riego (30 min)
unsigned long lastHeartbeatOk = 0;
unsigned long irrigationStartedAt = 0;

// --- INTERVALOS ---
const unsigned long SEND_INTERVAL_MS = 30000;        // lectura cada 30 s
const unsigned long HEARTBEAT_INTERVAL_MS = 15000;   // heartbeat cada 15 s
unsigned long lastSend = 0;
unsigned long lastHeartbeat = 0;

// --- FAILSAFE LOCAL ---
const uint8_t MAX_COMMUNICATION_FAILURES = 3;
uint8_t consecutiveCommunicationFailures = 0;
bool localFailsafeActive = false;
const char* localFailsafeReason = nullptr;
bool valveOpen = false;

// --- ASIGNACIÓN DE PINES ---
#define ONE_WIRE_BUS 4          // DS18B20 (GPIO 4)
#define MOISTURE_PIN 34         // Sensor capacitivo (GPIO 34 / A2)

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// --- CALIBRACIÓN DEL SENSOR DE HUMEDAD ---
const int DEFAULT_DRY_ADC = 3100;
const int DEFAULT_WET_ADC = 1100;
const int CALIBRATION_SAMPLES = 32;
const char* CALIBRATION_NAMESPACE = "soil-cal";
int valorSeco = DEFAULT_DRY_ADC;
int valorHumedo = DEFAULT_WET_ADC;
Preferences calibrationStorage;

// =====================================================================
// VÁLVULA
// =====================================================================
void setValveOutput(bool open) {
  if (open != valveOpen) {
    Serial.println(open ? "VALVULA -> ABIERTA" : "VALVULA -> CERRADA");
    if (open) irrigationStartedAt = millis();
  }
  valveOpen = open;
  digitalWrite(VALVE_PIN, open ? LOW : HIGH);
}

void activateLocalFailsafe(const char* reason) {
  if (localFailsafeActive) return;
  localFailsafeActive = true;
  localFailsafeReason = reason;
  setValveOutput(false);
  Serial.printf("FAILSAFE local activo: %s\n", reason);
}

// Cierre local sin depender del backend: por falta de heartbeat o por tiempo máximo
void checkLocalFailsafe() {
  if (!valveOpen || localFailsafeActive) return;
  if (millis() - lastHeartbeatOk > COMM_TIMEOUT_MS) {
    activateLocalFailsafe("sin heartbeat valido por 60 s");
  } else if (millis() - irrigationStartedAt > MAX_IRRIGATION_MS) {
    activateLocalFailsafe("tiempo maximo de riego");
  }
}

void applyDesiredValveState(const String& response) {
  if (localFailsafeActive) {
    setValveOutput(false);
    return;
  }
  const bool shouldOpen =
    response.indexOf("\"valve\":\"open\"") >= 0 ||
    response.indexOf("\"desired_status\":\"open\"") >= 0;
  const bool shouldClose =
    response.indexOf("\"valve\":\"closed\"") >= 0 ||
    response.indexOf("\"desired_status\":\"closed\"") >= 0;
  if (shouldOpen) {
    setValveOutput(true);
  } else if (shouldClose) {
    setValveOutput(false);
  }
}

// =====================================================================
// HUMEDAD Y CALIBRACIÓN
// =====================================================================
int readMoistureRaw() {
  long total = 0;
  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    total += analogRead(MOISTURE_PIN);
    delay(10);
  }
  return total / CALIBRATION_SAMPLES;
}

void loadCalibration() {
  if (!calibrationStorage.begin(CALIBRATION_NAMESPACE, true)) {
    Serial.println("Error: no se pudo abrir la memoria de calibracion.");
    return;
  }
  valorSeco = calibrationStorage.getInt("dry", DEFAULT_DRY_ADC);
  valorHumedo = calibrationStorage.getInt("wet", DEFAULT_WET_ADC);
  calibrationStorage.end();

  if (valorSeco <= valorHumedo) {
    Serial.println("Calibracion invalida guardada; usando valores por defecto.");
    valorSeco = DEFAULT_DRY_ADC;
    valorHumedo = DEFAULT_WET_ADC;
  }
}

void saveCalibration(int dryAdc, int wetAdc) {
  if (dryAdc <= wetAdc || dryAdc > 4095 || wetAdc < 0) {
    Serial.println("Error: calibracion fuera de rango; seco debe ser mayor que humedo (0-4095).");
    return;
  }

  if (!calibrationStorage.begin(CALIBRATION_NAMESPACE, false)) {
    Serial.println("Error: no se pudo guardar la calibracion.");
    return;
  }
  const size_t dryBytes = calibrationStorage.putInt("dry", dryAdc);
  const size_t wetBytes = calibrationStorage.putInt("wet", wetAdc);
  calibrationStorage.end();
  if (dryBytes == 0 || wetBytes == 0) {
    Serial.println("Error: no se pudo escribir la calibracion completa.");
    return;
  }
  valorSeco = dryAdc;
  valorHumedo = wetAdc;
  Serial.printf("Calibracion guardada: seco=%d, humedo=%d\n", valorSeco, valorHumedo);
}

void printCalibrationHelp() {
  Serial.println("Comandos de calibracion:");
  Serial.println("  cal dry   - coloca el sensor en suelo seco y toma muestras");
  Serial.println("  cal wet   - coloca el sensor en suelo humedo y toma muestras");
  Serial.println("  cal show  - muestra los valores actuales");
  Serial.println("  cal reset - restaura los valores por defecto");
}

void printCalibration() {
  Serial.printf("Calibracion actual: seco=%d, humedo=%d\n", valorSeco, valorHumedo);
}

void handleSerialCommand() {
  if (!Serial.available()) return;

  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toLowerCase();

  if (command == "cal dry" || command == "cal wet") {
    const bool drySample = command == "cal dry";
    Serial.printf("Muestreando punto %s (%d lecturas)...\n",
      drySample ? "seco" : "humedo", CALIBRATION_SAMPLES);
    const int value = readMoistureRaw();
    Serial.printf("ADC %s: %d\n", drySample ? "seco" : "humedo", value);
    saveCalibration(drySample ? value : valorSeco, drySample ? valorHumedo : value);
  } else if (command == "cal show") {
    printCalibration();
  } else if (command == "cal reset") {
    saveCalibration(DEFAULT_DRY_ADC, DEFAULT_WET_ADC);
  } else if (command == "cal help") {
    printCalibrationHelp();
  } else {
    Serial.println("Comando no reconocido. Escribe 'cal help'.");
  }
}

// =====================================================================
// WIFI
// =====================================================================
void conectarWiFi() {
  Serial.print("Conectando a ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(500);
    Serial.print(".");
    checkLocalFailsafe();   // la válvula se cierra aunque no haya red
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

// =====================================================================
// HTTP
// =====================================================================
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
  client.setInsecure();            // sin validar certificado (se corrige en HU-27)
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

// Solo el heartbeat cuenta para el failsafe: es el canal que lleva la orden de la válvula
void recordCommunicationResult(int code, const char* reason) {
  if (code >= 200 && code < 300) {
    consecutiveCommunicationFailures = 0;
    return;
  }

  if (consecutiveCommunicationFailures < 255) {
    consecutiveCommunicationFailures++;
  }
  if (consecutiveCommunicationFailures >= MAX_COMMUNICATION_FAILURES) {
    activateLocalFailsafe(reason);
    Serial.printf("(%u fallos consecutivos)\n", consecutiveCommunicationFailures);
  }
}

// Confirma que el nodo sigue conectado aunque el sensor de temperatura falle.
int enviarHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return -1;

  char body[220];
  snprintf(body, sizeof(body),
    "{\"sensor_id\":\"%s\",\"rssi\":%d,\"uptime_s\":%lu,\"actual_status\":\"%s\","
    "\"failsafe_active\":%s,\"failure_count\":%u,\"failure_reason\":\"%s\"}",
    SENSOR_ID, WiFi.RSSI(), millis() / 1000,
    valveOpen ? "open" : "closed",
    localFailsafeActive ? "true" : "false",
    consecutiveCommunicationFailures,
    localFailsafeReason ? localFailsafeReason : "");

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setConnectTimeout(15000);
  http.setTimeout(15000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  int code = -1;
  if (http.begin(client, HEARTBEAT_URL)) {
    http.addHeader("Content-Type", "application/json");
    code = http.POST(body);
    Serial.print(" HEARTBEAT -> ");
    if (code > 0) {
      const String response = http.getString();
      if (code >= 200 && code < 300) lastHeartbeatOk = millis();
      applyDesiredValveState(response);
      Serial.print(code);
      Serial.print(" -> ");
      Serial.println(response);
    } else {
      Serial.println(HTTPClient::errorToString(code));
    }
    http.end();
  } else {
    Serial.println(" HEARTBEAT -> no se pudo iniciar HTTP");
  }
  return code;
}

// =====================================================================
// SETUP / LOOP
// =====================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Relé apagado ANTES de configurar el pin como salida (sin pulso al arrancar)
  digitalWrite(VALVE_PIN, HIGH);
  pinMode(VALVE_PIN, OUTPUT);
  setValveOutput(false);
  lastHeartbeatOk = millis();

  // Inicializar sensores
  sensors.begin();
  pinMode(MOISTURE_PIN, INPUT);
  loadCalibration();
  printCalibration();
  printCalibrationHelp();

  // Conectar a internet
  conectarWiFi();
}

void loop() {
  handleSerialCommand();
  checkLocalFailsafe();

  // 1. Verificar y mantener la conexión Wi-Fi (reconexión automática)
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdido, reconectando...");
    conectarWiFi();
  }

  // 2. Lectura de temperatura del entorno (DS18B20)
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);

  // 3. Lectura de humedad del suelo
  int valorHumedadRaw = readMoistureRaw();
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

  Serial.println(" Estado Wi-Fi: " + String(WiFi.status() == WL_CONNECTED ? "Conectado (IP: " + WiFi.localIP().toString() + ")" : "Desconectado"));
  Serial.printf(" Valvula: %s\n", valveOpen ? "ABIERTA" : "CERRADA");

  // 5. Enviar al dashboard cada 30 s (solo si el DS18B20 lee bien).
  //    El resultado de las lecturas NO cuenta para el failsafe (un 422 no es una falla de red).
  if (tempOk && (lastSend == 0 || millis() - lastSend >= SEND_INTERVAL_MS)) {
    lastSend = millis();
    enviarLectura(tempC, porcentajeHumedad, valorHumedadRaw);
  }

  // 6. Heartbeat independiente de las lecturas; recibe la orden de la válvula
  if (lastHeartbeat == 0 || millis() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = millis();
    const int code = enviarHeartbeat();
    const bool failsafeReported = localFailsafeActive;
    recordCommunicationResult(code, "fallo de heartbeat");
    if (failsafeReported && code >= 200 && code < 300) {
      Serial.println("Failsafe reportado; reiniciando el ESP32.");
      delay(1000);
      ESP.restart();
    }
  }

  // Esperar 5 segundos antes de la siguiente lectura
  delay(5000);
}