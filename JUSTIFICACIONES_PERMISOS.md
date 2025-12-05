# Justificaciones de Permisos para Chrome Web Store

## Permisos que necesitan justificación

### 1. Justificación de sidePanel* (FALTA COMPLETAR)

**Texto sugerido (español):**
```
El permiso sidePanel es necesario para mostrar la interfaz principal de la extensión donde el usuario puede iniciar la extracción de contactos, ver el progreso en tiempo real, pausar o reanudar el proceso, y descargar los datos extraídos en diferentes formatos (CSV, Excel, JSON, VCard). El panel lateral proporciona una experiencia de usuario integrada sin necesidad de abrir una ventana emergente separada.
```

**Caracteres:** ~280/1,000

---

### 2. Justificación de tabs* (FALTA COMPLETAR)

**Texto sugerido (español):**
```
Este permiso es esencial para detectar si WhatsApp Web está abierto en alguna pestaña del navegador, verificar el estado de la pestaña activa, y enfocar automáticamente la pestaña de WhatsApp Web cuando el usuario inicia la extracción. También permite monitorear cuando el usuario cambia de pestaña o cierra WhatsApp Web para actualizar el estado de la extensión en tiempo real.
```

**Caracteres:** ~250/1,000

---

## Permisos ya completados (para referencia)

### 3. Justificación de activeTab*
✅ **Ya completado:**
```
Se utiliza para acceder e interactuar con el DOM de la pestaña donde el usuario tiene abierto WhatsApp Web activamente, permitiendo que el script lea la información de los contactos visibles en pantalla.
```
**Caracteres:** 203/1,000

---

### 4. Justificación de scripting*
✅ **Ya completado:**
```
Es necesario para inyectar el script de contenido que realiza la funcionalidad principal: el scroll automático por la lista de chats y la extracción de los datos de los contactos dentro de la página de WhatsApp Web.
```
**Caracteres:** 215/1,000

---

### 5. Justificación de downloads*
✅ **Ya completado:**
```
Este permiso es esencial para permitir que la extensión guarde los datos extraídos en el ordenador del usuario, generando y descargando los archivos finales (CSV, Excel, VCard, etc.).
```
**Caracteres:** 183/1,000

---

### 6. Justificación de storage*
✅ **Ya completado:**
```
Se utiliza para almacenar temporalmente el progreso de la extracción y los datos de los contactos detectados de forma local en el navegador. Esto permite funciones como pausar, reanudar y evitar duplicados durante el proceso.
```
**Caracteres:** 225/1,000

---

### 7. Justificación de Permiso de host*
✅ **Ya completado:**
```
La extensión requiere acceso a este host específico porque su única funcionalidad es interactuar con la interfaz web de WhatsApp para extraer la lista de contactos del usuario. No funciona en ningún otro sitio web.
```
**Caracteres:** 214/1,000

---

## Código remoto

✅ **Ya completado:**
- Seleccionado: "No, no estoy usando código remoto"

---

## Resumen

**Permisos pendientes de completar:**
- [ ] sidePanel
- [ ] tabs

**Permisos ya completados:**
- [x] activeTab
- [x] scripting
- [x] downloads
- [x] storage
- [x] Permiso de host
- [x] Código remoto

