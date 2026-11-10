#pragma once

// Reemplaza este valor por el certificado raiz PEM de la CA que emite
// el certificado TLS de tu dominio publico.
const char* ROOT_CA_PEM = R"EOF(
-----BEGIN CERTIFICATE-----
PEGA_AQUI_EL_CERTIFICADO_RAIZ
-----END CERTIFICATE-----
)EOF";
