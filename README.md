<p align="center">
  <img src="favicon/android-chrome-192x192.png" alt="Snatch WhatsApp Exporter Logo" width="100">
</p>

<h1 align="center">🐍 Snatch WhatsApp Exporter</h1>

<p align="center">
  <strong>Exporta tus contactos de WhatsApp Web de forma rápida, automática y 100% privada</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Versión-2.1-green.svg" alt="Versión">
  <img src="https://img.shields.io/badge/Manifest-V3-blue.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Plataforma-Chrome-yellow.svg" alt="Chrome">
  <img src="https://img.shields.io/badge/Licencia-MIT-orange.svg" alt="Licencia">
</p>

---

## 📋 Descripción

**Snatch WhatsApp Exporter** es una extensión de Chrome que permite extraer y exportar automáticamente todos los contactos de WhatsApp Web. La extensión escanea tu lista de chats mediante scroll automático y extrae la información de cada contacto sin necesidad de intervención manual.

### ✨ Características Principales

| Característica | Descripción |
|----------------|-------------|
| 🔄 **Extracción Automática** | Scroll automático por toda la lista de chats |
| 📁 **Múltiples Formatos** | Exporta a CSV, Excel, JSON y VCard |
| 🔒 **100% Privado** | Todo el procesamiento ocurre localmente |
| 💾 **Guardado Automático** | Nunca pierde el progreso de la extracción |
| 🌍 **Multi-idioma** | Funciona con WhatsApp en cualquier idioma |
| ⏸️ **Pausar/Reanudar** | Control total sobre el proceso de extracción |

---

## 📦 Formatos de Exportación

- **CSV** - Compatible con Excel, Google Sheets y cualquier software de hojas de cálculo
- **Excel (.xls)** - Formato nativo de Microsoft Excel
- **JSON** - Ideal para desarrolladores e integraciones con APIs
- **VCard (.vcf)** - Importable directamente en iPhone y Android

---

## 📊 Datos que Extrae

Por cada contacto o chat, la extensión obtiene:

- ✅ Nombre del contacto o grupo
- ✅ Número de teléfono (si está visible)
- ✅ Último mensaje del chat
- ✅ Marca de tiempo

---

## 🚀 Instalación

### Desde el código fuente

1. **Descarga o clona** este repositorio
   ```bash
   git clone https://github.com/tu-usuario/snatch-whatsapp-exporter.git
   ```

2. **Abre Chrome** y navega a `chrome://extensions/`

3. **Activa el "Modo desarrollador"** (esquina superior derecha)

4. **Haz clic en "Cargar descomprimida"**

5. **Selecciona la carpeta** del proyecto

6. ¡Listo! La extensión aparecerá en tu barra de herramientas

---

## 📖 Cómo Usar

1. **Abre** [WhatsApp Web](https://web.whatsapp.com) e inicia sesión
2. **Haz clic** en el icono de la extensión en la barra de Chrome
3. **Presiona** "Iniciar Extracción"
4. **Espera** mientras la extensión escanea automáticamente tus chats
5. **Selecciona** el formato deseado (CSV, Excel, JSON o VCard)
6. **Descarga** tus contactos

> 💡 **Tip:** Mantén WhatsApp Web abierto durante todo el proceso de extracción.

---

## 🎯 Casos de Uso

### 📱 Respaldo de Contactos
- Hacer backup de todos los contactos de WhatsApp
- Migrar contactos a otro dispositivo

### 💼 Gestión de Negocios
- Exportar lista de clientes de WhatsApp Business
- Crear bases de datos de contactos para CRM
- Organizar contactos de leads y prospectos

### 🔄 Migración de Dispositivos
- Exportar a VCard para importar en iPhone o Android
- Transferir contactos entre cuentas

### 📈 Análisis y Organización
- Organizar contactos en hojas de cálculo
- Filtrar y categorizar contactos
- Crear listas de distribución

---

## 🔐 Permisos

| Permiso | Uso |
|---------|-----|
| `activeTab` | Interactuar con la pestaña activa de WhatsApp Web |
| `scripting` | Ejecutar el script de extracción |
| `downloads` | Descargar los archivos exportados |
| `storage` | Guardar el progreso temporalmente |

**Host permissions:**
- `https://web.whatsapp.com/*` (solo funciona en WhatsApp Web)

---

## 🛡️ Privacidad y Seguridad

- ✅ **100% Local** - No envía datos a ningún servidor externo
- ✅ **Sin Cuenta** - No requiere registro ni login
- ✅ **Sin Nube** - No almacena datos en servidores remotos
- ✅ **Código Abierto** - Puedes revisar todo el código fuente

---

## 💻 Compatibilidad

| Requisito | Especificación |
|-----------|----------------|
| **Navegador** | Google Chrome 88+ |
| **Sistemas** | Windows, macOS, Linux |
| **Requisitos** | WhatsApp Web con sesión iniciada |
| **Manifest** | Versión 3 |

---

## 🗂️ Estructura del Proyecto

```
📁 snatch-whatsapp-exporter/
├── 📄 manifest.json        # Configuración de la extensión
├── 📄 popup.html           # Interfaz del popup
├── 📄 popup.js             # Lógica del popup
├── 📄 popup.css            # Estilos del popup
├── 📄 sidepanel.html       # Panel lateral alternativo
├── 📄 sidepanel.js         # Lógica del panel lateral
├── 📄 background.js        # Service worker
├── 📄 content.js           # Script de extracción (inyectado en WhatsApp)
├── 📄 content.css          # Estilos inyectados
└── 📁 favicon/             # Iconos de la extensión
    ├── favicon.ico
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── android-chrome-192x192.png
    ├── android-chrome-512x512.png
    └── apple-touch-icon.png
```

---

## 🛠️ Tecnologías Utilizadas

- **JavaScript ES6+**
- **Chrome Extension APIs (Manifest V3)**
- **HTML5 / CSS3**
- **Chrome Storage API**
- **Chrome Downloads API**

---

## 🐛 Solución de Problemas

### WhatsApp Web no se detecta
- Asegúrate de estar en `web.whatsapp.com`
- Verifica que la sesión esté iniciada
- Recarga la página de WhatsApp Web

### La extracción se detiene
- Es normal que se detenga al llegar al final de la lista
- Puedes reanudar en cualquier momento

### No se descargan los archivos
- Verifica que Chrome tenga permisos de descarga
- Comprueba la carpeta de descargas

---

## 📝 Changelog

### v2.1 (Actual)
- Selectores actualizados para WhatsApp Web 2024-2025
- Mejora en la detección de contactos
- Soporte multi-idioma mejorado (14 idiomas)
- Corrección de errores de scroll
- Interfaz mejorada con side panel
- Guardado automático de progreso

### v2.0
- Migración completa a Manifest V3
- Implementación de side panel
- Mejoras en la estabilidad del servicio worker
- Optimización de rendimiento

### v1.3
- Selectores actualizados para WhatsApp Web
- Mejora en la detección de contactos
- Soporte multi-idioma mejorado
- Corrección de errores de scroll

### v1.2
- Añadido soporte para VCard
- Guardado automático de progreso
- Interfaz mejorada

### v1.1
- Soporte para múltiples formatos
- Detección de duplicados
- Panel lateral alternativo

### v1.0
- Versión inicial
- Extracción básica de contactos

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/NuevaFuncion`)
3. Commit tus cambios (`git commit -m 'Añadir nueva función'`)
4. Push a la rama (`git push origin feature/NuevaFuncion`)
5. Abre un Pull Request

---

## ⚠️ Aviso Legal

Esta extensión está diseñada para uso personal y legítimo. El usuario es responsable de cumplir con los términos de servicio de WhatsApp y las leyes de protección de datos aplicables en su jurisdicción.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

---

<p align="center">
  Hecho con ❤️ para la comunidad
</p>

<p align="center">
  <a href="#-snatch-whatsapp-exporter">⬆️ Volver arriba</a>
</p>




