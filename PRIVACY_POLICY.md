# 🛡️ Política de Privacidad de Snatch WhatsApp Exporter

**Última actualización:** 04 de diciembre de 2025

Esta Política de Privacidad describe cómo la extensión de navegador "Snatch WhatsApp Exporter" (en adelante, "la Extensión") maneja su información cuando la utiliza.
Su privacidad es primordial para nosotros. El principio fundamental de esta Extensión es que sus datos le pertenecen a usted y nunca salen de su dispositivo.

## 1. Principio Fundamental: Procesamiento Local (100% Offline)
Snatch WhatsApp Exporter está diseñada para funcionar de forma **100% local** en su navegador.
La Extensión **NO** recopila, transmite, almacena ni comparte ninguna información personal o datos de sus contactos con nosotros ni con servidores de terceros.

## 2. Recopilación y Procesamiento de Datos
Para cumplir su función principal de exportación, el script de la Extensión se ejecuta únicamente dentro de la pestaña de su navegador donde tiene abierto WhatsApp Web e interactúa temporalmente con los datos visibles en pantalla.

**Datos leídos y procesados localmente:**
La Extensión lee y procesa los siguientes datos de su sesión activa de WhatsApp Web:
*   Nombres de contactos o grupos.
*   Números de teléfono (si están visibles).
*   El contenido del último mensaje visible en la lista de chats.
*   Marcas de tiempo de los mensajes.

## 3. Uso de la Información
La única finalidad del procesamiento de los datos es permitirle a usted, el usuario, exportar su propia lista de contactos a archivos locales en formatos como CSV, Excel, JSON o VCard.

*   **Finalidad Exclusiva:** Los datos procesados se utilizan exclusivamente para generar los archivos descargables en su ordenador (para uso personal, respaldo o gestión).
*   **Prohibición de Uso Externo:** No vendemos, transferimos ni utilizamos sus datos para publicidad o propósitos distintos a la funcionalidad principal de la extensión.

## 4. Almacenamiento y Seguridad de los Datos
*   **Procesamiento Local:** Todo el análisis y la extracción de datos ocurren enteramente dentro de la memoria de su navegador web.
*   **Almacenamiento Temporal (Local):** La Extensión utiliza el almacenamiento local de su navegador (`chrome.storage.local`) únicamente para guardar el progreso de la extracción de forma temporal (por ejemplo, para permitir pausar y reanudar).
    *   Estos datos temporales permanecen en su dispositivo y se eliminan al desinstalar la extensión o al usar la opción de "Borrar datos".
*   **Sin Servidores Externos:** No tenemos bases de datos en la nube ni servidores externos que reciban o almacenen su información.
*   **Sin Rastreadores:** No utilizamos cookies ni herramientas de análisis de terceros.

## 5. Permisos de la Extensión
Para funcionar, la Extensión requiere los siguientes permisos mínimos, que se utilizan exclusivamente para el propósito descrito:

| Permiso Requerido | Propósito del Uso |
| :--- | :--- |
| `activeTab` y Host `https://web.whatsapp.com/*` | Necesario para que el script pueda acceder únicamente a la pestaña donde usted utiliza WhatsApp Web para leer la lista de contactos. |
| `scripting` | Permite ejecutar el código que realiza el scroll automático y la extracción de datos dentro de la página. |
| `storage` | Permite guardar el progreso de la extracción temporalmente en su navegador. |
| `downloads` | Permite a la Extensión guardar los archivos finales (Excel, CSV, etc.) en la carpeta de descargas de su ordenador. |
| `tabs` | Para detectar si la pestaña de WhatsApp Web está abierta en segundo plano. |
| `sidePanel` | Permite mostrar la interfaz de usuario junto a la página de WhatsApp para una mejor experiencia sin ventanas emergentes. |

## 6. Cumplimiento Normativo
El uso de la información recibida a través de las APIs de Chrome se adhiere a la **Política de Datos del Usuario de Chrome Web Store**, incluidos los requisitos de Uso Limitado.

## 7. Cambios a esta Política
Podemos actualizar esta política de privacidad ocasionalmente. Le recomendamos que revise esta página periódicamente para estar al tanto de cualquier cambio. El uso continuado de la Extensión después de cualquier modificación constituirá su aceptación de dichos cambios.

## 8. Contacto
Si tiene preguntas o inquietudes sobre esta Política de Privacidad o sobre cómo funciona la Extensión, puede contactarnos a través de:
📧 **jonastantra@gmail.com**

## 9. Sus Derechos
Dado que la Extensión opera localmente, usted tiene control total sobre sus datos. Puede acceder a ellos, rectificarlos o eliminarlos en cualquier momento simplemente borrando el almacenamiento de la extensión o desinstalándola. No necesitamos procesar solicitudes de eliminación porque nunca tenemos sus datos.
