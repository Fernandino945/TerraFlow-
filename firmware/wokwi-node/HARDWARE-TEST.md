# Prueba de hardware del nodo ESP32

La suite de backend no necesita hardware. Esta prueba valida la integración final
con un ESP32, un sensor DS18B20, un sensor capacitivo de humedad y un módulo de
relé activo en bajo.

## Conexiones

| Componente | ESP32 |
|---|---|
| DS18B20 VCC | 3V3 |
| DS18B20 GND | GND |
| DS18B20 DQ | GPIO 4 |
| Resistencia pull-up | 4.7 kOhm entre DQ y 3V3 |
| Sensor de humedad VCC | 3V3 |
| Sensor de humedad GND | GND |
| Sensor de humedad SIG | GPIO 34 |
| Relé IN1 | GPIO 26 |
| Relé VCC/GND | Fuente compatible del módulo y GND común |

No conectes una válvula de tensión de red durante la primera prueba. Usa un LED
o una carga de baja tensión y confirma que el relé es activo en bajo.

## Preparación

1. Copia `secrets.example.h` como `secrets.h` y completa SSID, contraseña,
   URL HTTPS pública del backend y `NODE_API_KEY`.
2. Copia `root_ca.example.h` como `root_ca.h` y pega el certificado raíz de la
   CA que firma el endpoint HTTPS. No uses `client.setInsecure()` en producción.
3. Abre `sketch.ino` en Arduino IDE o el proyecto en Wokwi.
4. Instala las librerías listadas en `libraries.txt`.
5. Selecciona una placa ESP32 Dev Module y carga el firmware.

## Prueba paso a paso

1. Abre el monitor serial a **115200 baudios**.
2. Confirma `¡Conectado a la red Wi-Fi!` y la hora sincronizada.
3. Ejecuta `cal show`; para calibrar usa `cal dry`, luego `cal wet`, y verifica
   los valores con `cal show`.
4. Confirma cada 15 segundos una línea `HEARTBEAT -> 200` con
   `"desired_status":"closed"` cuando la válvula está cerrada.
5. Abre la válvula desde el dashboard y confirma en el siguiente heartbeat
   `desired_status:"open"` y la activación del relé.
6. Cierra la válvula desde el dashboard y confirma `desired_status:"closed"`.
7. Desconecta temporalmente el backend o bloquea su acceso durante tres
   heartbeats. El nodo debe imprimir `FAILSAFE local activo` y desactivar el relé.
8. Vuelve a conectar el backend. El nodo debe reportar el failsafe y reiniciarse;
   después debe volver a mostrar `HEARTBEAT -> 200`.

## Wokwi

El archivo `diagram.json` ya conecta el potenciómetro al GPIO 34 y el DS18B20
al GPIO 4 con su resistencia de 4.7 kOhm. Para que el heartbeat sea exitoso,
configura `secrets.h` con un backend accesible desde Internet (por ejemplo, un
endpoint HTTPS temporal). El relé no está modelado en el diagrama actual; valida
su salida observando GPIO 26 o agrega un módulo de relé de Wokwi antes de probar
la carga.
