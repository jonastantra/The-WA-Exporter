# Checklist para Chrome Web Store - Snatch WhatsApp Exporter v2.1

## ✅ Preparación Completada

### Archivos Verificados
- [x] `manifest.json` - Versión 2.1, Manifest V3
- [x] `background.js` - Service worker configurado
- [x] `content.js` - Script de contenido
- [x] `sidepanel.html/js/css` - Panel lateral completo
- [x] `i18n.js` - Sistema de traducciones
- [x] Iconos (16x16, 32x32, 48x48, 128x128)
- [x] 14 idiomas de traducción completos

### Archivo ZIP Creado
- ✅ `snatch-whatsapp-exporter-v2.1.zip` (0.44 MB)
- ✅ Sin archivos innecesarios
- ✅ Estructura correcta

## 📋 Checklist Antes de Subir

### Información Básica
- [ ] Nombre de la extensión: "Snatch WhatsApp Exporter"
- [ ] Descripción corta (132 caracteres máximo)
- [ ] Descripción detallada
- [ ] Categoría: Productividad / Utilidades
- [ ] Idioma principal: Español

### Imágenes Requeridas
- [ ] Icono pequeño (16x16) - ✅ Incluido
- [ ] Icono (128x128) - ✅ Incluido
- [ ] Captura de pantalla pequeña (640x400 o 1280x800)
- [ ] Captura de pantalla grande (1280x800 o 2560x1600)
- [ ] Captura de pantalla promocional (920x680 o 1400x560) - Opcional
- [ ] Video promocional - Opcional

### Información Adicional
- [ ] URL del sitio web (si aplica)
- [ ] URL de soporte
- [ ] Email de contacto del desarrollador
- [ ] Política de privacidad - ✅ Disponible en PRIVACY_POLICY.md

### Permisos Explicados
La extensión requiere los siguientes permisos:
- `sidePanel`: Para mostrar el panel lateral de la extensión
- `activeTab`: Para interactuar con la pestaña de WhatsApp Web
- `scripting`: Para ejecutar scripts en WhatsApp Web
- `downloads`: Para descargar los archivos exportados
- `storage`: Para guardar temporalmente los datos extraídos
- `tabs`: Para detectar si WhatsApp Web está abierto

**Host Permission:**
- `https://web.whatsapp.com/*`: Solo funciona en WhatsApp Web

### Política de Privacidad
- ✅ Política de privacidad disponible en `PRIVACY_POLICY.md`
- [ ] Subir política de privacidad a un sitio web accesible
- [ ] Proporcionar URL en el formulario de Chrome Web Store

### Contenido y Cumplimiento
- [ ] La extensión no viola los términos de servicio de WhatsApp
- [ ] No recopila datos personales
- [ ] Todo el procesamiento es local
- [ ] No hay servicios de terceros
- [ ] No hay publicidad ni rastreadores

### Pruebas Locales
- [ ] Cargar extensión en modo desarrollador
- [ ] Probar extracción de contactos
- [ ] Verificar exportación a CSV, Excel, JSON, VCard
- [ ] Probar en diferentes idiomas
- [ ] Verificar que el side panel funcione correctamente
- [ ] Probar pausar/reanudar extracción
- [ ] Verificar guardado automático

### Información del Desarrollador
- [ ] Cuenta de desarrollador de Chrome Web Store activa
- [ ] Pago único de $5 USD completado (si es primera vez)
- [ ] Información de contacto actualizada

## 📝 Notas Importantes

1. **Versión**: Asegúrate de incrementar la versión en `manifest.json` para futuras actualizaciones
2. **Pruebas**: Prueba la extensión en un perfil limpio de Chrome antes de subir
3. **Capturas**: Las capturas de pantalla deben mostrar la funcionalidad real de la extensión
4. **Descripción**: Sé claro sobre qué hace la extensión y qué permisos necesita
5. **Privacidad**: Enfatiza que todo es local y no se envía información a servidores

## 🚀 Pasos para Subir

1. Ve a [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Haz clic en "Nuevo elemento"
3. Sube el archivo `snatch-whatsapp-exporter-v2.1.zip`
4. Completa toda la información requerida
5. Agrega capturas de pantalla
6. Proporciona la URL de la política de privacidad
7. Revisa y envía para revisión

## ⏱️ Tiempo de Revisión

- Primera revisión: 1-3 días hábiles
- Actualizaciones: 1-3 días hábiles
- Revisiones adicionales pueden ser necesarias si hay problemas

## 📞 Soporte

Si tienes problemas durante la revisión:
- Revisa los comentarios del revisor en el dashboard
- Corrige los problemas señalados
- Responde a las preguntas del revisor
- Vuelve a enviar para revisión

---

**Última actualización**: $(Get-Date -Format 'yyyy-MM-dd')
**Versión del paquete**: 2.1
**Tamaño del ZIP**: 0.44 MB

