# 🛰️ PlutoTV IPTV Proxy Server

Servidor proxy automático para PlutoTV que expone endpoints HTTP para M3U8 y EPG con actualizaciones automáticas.

## 🚀 Características

- ✅ **Servidor HTTP** con endpoints para M3U8 y EPG
- 🔄 **Actualización automática** cada X minutos (configurable)
- ⚡ **Cache inteligente** para optimizar peticiones
- 📺 **EPG extendido** (configurable hasta 24+ horas)
- 🎯 **Soporte para favoritos** (filtrado de canales)
- 📊 **Endpoint de estado** para monitoreo
- 🔧 **Actualización manual** vía API REST
- 💾 **Respaldos locales** automáticos

## 📋 Requisitos

- Node.js >= 14.0.0
- npm o yarn

## 🔧 Instalación

1. **Clonar o descargar el proyecto**

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno (opcional):**
```bash
cp .env.example .env
# Editar .env con tus preferencias
```

4. **Configurar favoritos (opcional):**
```bash
cp pluto-favorites.example pluto-favorites
# Editar pluto-favorites y descomentar los canales que quieres
```

> **Nota:** Si no configuras favoritos, se cargarán TODOS los canales de PlutoTV

## ⚙️ Configuración

Puedes configurar el servidor mediante variables de entorno:

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| `PORT` | Puerto del servidor HTTP | 3000 |
| `UPDATE_INTERVAL` | Intervalo de actualización en minutos | 30 |
| `EPG_HOURS` | Horas de EPG hacia adelante | 24 |

### Ejemplo de configuración:

```bash
# .env
PORT=8080
UPDATE_INTERVAL=15
EPG_HOURS=48
```

## 🎯 Uso

### Iniciar el servidor

```bash
npm start
```

### Modo desarrollo (con auto-restart)

```bash
npm run dev
```

### Usando PM2 (recomendado para producción)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar con PM2
npm run pm2:start

# Ver logs
npm run pm2:logs

# Reiniciar
npm run pm2:restart

# Detener
npm run pm2:stop
```

## 📡 Endpoints

Una vez iniciado el servidor, tendrás acceso a:

### 1. **Página principal**
```
http://localhost:3000/
```
Página web con información y links a todos los endpoints

### 2. **Playlist M3U8**
```
http://localhost:3000/playlist.m3u8
```
Lista de canales en formato M3U8 compatible con reproductores IPTV

### 3. **EPG XML**
```
http://localhost:3000/epg.xml
```
Guía de programación en formato XMLTV

### 4. **Estado del servidor**
```
GET http://localhost:3000/status
```
Información del estado actual del servidor

**Respuesta:**
```json
{
  "status": "running",
  "lastUpdate": "2025-10-03 15:30:00",
  "nextUpdate": "2025-10-03 16:00:00",
  "channelsCount": 245,
  "updateInterval": "30 minutes",
  "epgHours": "24 hours"
}
```

### 5. **Forzar actualización**
```
POST http://localhost:3000/refresh
```
Fuerza una actualización inmediata de datos

**Ejemplo con curl:**
```bash
curl -X POST http://localhost:3000/refresh
```

## 📺 Configurar en tu reproductor IPTV

### VLC
1. Abre VLC
2. Media → Open Network Stream
3. Ingresa: `http://TU_IP:3000/playlist.m3u8`

### Kodi
1. Instala PVR IPTV Simple Client
2. Configuración:
   - M3U URL: `http://TU_IP:3000/playlist.m3u8`
   - EPG URL: `http://TU_IP:3000/epg.xml`

### TiviMate, IPTV Smarters, etc.
- Playlist URL: `http://TU_IP:3000/playlist.m3u8`
- EPG URL: `http://TU_IP:3000/epg.xml`

## 🎯 Filtro de Favoritos

Si quieres filtrar solo ciertos canales, puedes crear un archivo `pluto-favorites` (sin extensión) con los canales que deseas.

### Crear archivo de favoritos:

```bash
# Copiar el ejemplo
cp pluto-favorites.example pluto-favorites

# Editar y descomentar los canales que quieres
nano pluto-favorites
```

### Formato del archivo:

Puedes usar cualquiera de estos formatos:

**Opción 1: Un canal por línea**
```
cnn-en-espanol
pluto-tv-cine-estelar
mtv-pluto-tv
```

**Opción 2: Separados por comas**
```
cnn-en-espanol, pluto-tv-cine-estelar, mtv-pluto-tv
```

**Opción 3: JSON array**
```json
["cnn-en-espanol", "pluto-tv-cine-estelar", "mtv-pluto-tv"]
```

**Opción 4: Nombres parciales** (filtrará todos los canales que contengan ese texto)
```
cine
deportes
noticias
```

> **Nota:** Si el archivo `pluto-favorites` no existe o está vacío, se cargarán TODOS los canales disponibles.

## 📁 Estructura del proyecto

```
PlutoIPTV/
├── index.js                    # Servidor principal
├── favorites.js                # Módulo de filtros
├── package.json               # Dependencias
├── .env.example              # Configuración de ejemplo
├── pluto-favorites.example   # Favoritos de ejemplo
├── pluto-favorites           # Tu lista de favoritos (opcional)
├── cache.json                # Cache generado automáticamente
├── playlist.m3u8             # Playlist generado
└── epg.xml                   # EPG generado
```

### Archivos necesarios:
- ✅ `index.js` - Script principal
- ✅ `favorites.js` - Módulo de filtros
- ✅ `package.json` - Dependencias

### Archivos opcionales:
- 📝 `.env` - Configuración personalizada
- 📺 `pluto-favorites` - Lista de canales favoritos

### Archivos generados:
- 🗂️ `cache.json` - Cache de la API
- 📺 `playlist.m3u8` - Playlist M3U8
- 📋 `epg.xml` - Guía EPG

## 🔍 Logs

El servidor muestra logs detallados:

```
[INFO] Grabbing EPG from PlutoTV API...
[DEBUG] API URL: http://api.pluto.tv/v2/channels?...
[DEBUG] Cache updated successfully
[INFO] Generating M3U8 playlist...
[SUCCESS] Generated M3U8 with 245 channels
[INFO] Generating EPG XML...
[SUCCESS] Generated EPG with 245 channels and 3420 programmes
[SUCCESS] Data update completed successfully!
[INFO] Next update in 30 minutes
```

## 🐛 Troubleshooting

### El servidor no inicia
- Verifica que el puerto no esté en uso
- Comprueba las dependencias: `npm install`

### No hay canales
- Verifica tu conexión a internet
- Revisa si PlutoTV API está disponible
- Comprueba los logs para errores

### Actualización muy lenta
- Aumenta `UPDATE_INTERVAL` en `.env`
- Verifica tu ancho de banda

### Los canales no se actualizan
- Verifica que el servidor esté corriendo
- Usa el endpoint `/refresh` para forzar actualización
- Revisa los logs: `npm run pm2:logs`

## 🚀 Despliegue en producción

### Usando PM2

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start index.js --name pluto-iptv-proxy

# Configurar inicio automático
pm2 startup
pm2 save

# Monitoreo
pm2 monit
```

### Usando Docker (ejemplo básico)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

```bash
docker build -t pluto-iptv-proxy .
docker run -d -p 3000:3000 --name pluto-proxy pluto-iptv-proxy
```

## 📝 Notas

- El servidor usa cache para evitar sobrecargar la API de PlutoTV
- Las actualizaciones son automáticas según el intervalo configurado
- Los archivos locales sirven como respaldo en caso de fallo de API
- El servidor es resiliente a errores y continuará funcionando

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor abre un issue o pull request.

## 📄 Licencia

MIT

## ⚠️ Disclaimer

Este proyecto es solo para uso educativo. Respeta los términos de servicio de PlutoTV.