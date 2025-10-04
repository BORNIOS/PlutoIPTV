#!/usr/bin/env node

const express = require('express');
const request = require('request');
const moment = require('moment');
const fs = require('fs-extra');
const { v4: uuid4, v1: uuid1 } = require('uuid');
const { URL } = require('url');
const { create } = require('xmlbuilder2');
const favorites = require('./favorites');

// Configuración
const CONFIG = {
  PORT: process.env.PORT || 3000,
  UPDATE_INTERVAL: parseInt(process.env.UPDATE_INTERVAL) || 30, // minutos
  EPG_HOURS: parseInt(process.env.EPG_HOURS) || 24, // horas hacia adelante
  CACHE_FILE: 'cache.json',
  FAVORITES_PATH: './pluto-favorites',
  API_URL: 'http://api.pluto.tv/v2/channels'
};

// Estado global
let cachedData = {
  channels: [],
  m3u8: '',
  epg: '',
  lastUpdate: null,
  isUpdating: false
};

// Clase principal
class PlutoIPTVProxy {
  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    // Endpoint para M3U8
    this.app.get('/playlist.m3u8', (req, res) => {
      console.log(`[REQUEST] M3U8 playlist requested from ${req.ip}`);
      
      if (!cachedData.m3u8) {
        return res.status(503).send('Service initializing, please wait...');
      }

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u8"');
      res.send(cachedData.m3u8);
    });

    // Endpoint para EPG
    this.app.get('/epg.xml', (req, res) => {
      console.log(`[REQUEST] EPG requested from ${req.ip}`);
      
      if (!cachedData.epg) {
        return res.status(503).send('Service initializing, please wait...');
      }

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', 'inline; filename="epg.xml"');
      res.send(cachedData.epg);
    });

    // Endpoint de estado
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'running',
        lastUpdate: cachedData.lastUpdate,
        nextUpdate: this.getNextUpdateTime(),
        channelsCount: cachedData.channels.length,
        updateInterval: `${CONFIG.UPDATE_INTERVAL} minutes`,
        epgHours: `${CONFIG.EPG_HOURS} hours`
      });
    });

    // Endpoint para forzar actualización
    this.app.post('/refresh', async (req, res) => {
      console.log(`[REQUEST] Manual refresh requested from ${req.ip}`);
      
      if (cachedData.isUpdating) {
        return res.status(429).json({ 
          error: 'Update already in progress',
          message: 'Please wait for current update to complete'
        });
      }

      try {
        await this.updateData();
        res.json({ 
          success: true, 
          message: 'Data updated successfully',
          lastUpdate: cachedData.lastUpdate
        });
      } catch (error) {
        res.status(500).json({ 
          error: 'Update failed', 
          message: error.message 
        });
      }
    });

    // Página principal con información
    this.app.get('/', (req, res) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PlutoTV IPTV Proxy</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .endpoint { background: #f4f4f4; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .endpoint code { color: #d63384; }
            .status { background: #d4edda; padding: 10px; border-radius: 5px; margin: 20px 0; }
            .info { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>🛰️ PlutoTV IPTV Proxy Server</h1>
          
          <div class="status">
            <strong>Estado:</strong> ✅ Activo<br>
            <strong>Última actualización:</strong> ${cachedData.lastUpdate || 'Inicializando...'}<br>
            <strong>Canales disponibles:</strong> ${cachedData.channels.length}<br>
            <strong>Próxima actualización:</strong> ${this.getNextUpdateTime()}
          </div>

          <h2>📡 Endpoints Disponibles</h2>
          
          <div class="endpoint">
            <strong>M3U8 Playlist:</strong><br>
            <code>${baseUrl}/playlist.m3u8</code>
          </div>

          <div class="endpoint">
            <strong>EPG (Guía de Programación):</strong><br>
            <code>${baseUrl}/epg.xml</code>
          </div>

          <div class="endpoint">
            <strong>Estado del servidor:</strong><br>
            <code>${baseUrl}/status</code>
          </div>

          <div class="endpoint">
            <strong>Forzar actualización:</strong><br>
            <code>POST ${baseUrl}/refresh</code>
          </div>

          <div class="info">
            <h3>⚙️ Configuración</h3>
            <ul>
              <li>Intervalo de actualización: ${CONFIG.UPDATE_INTERVAL} minutos</li>
              <li>EPG para las próximas: ${CONFIG.EPG_HOURS} horas</li>
              <li>Puerto: ${CONFIG.PORT}</li>
            </ul>
          </div>
        </body>
        </html>
      `);
    });
  }

  getNextUpdateTime() {
    if (!cachedData.lastUpdate) return 'Calculando...';
    
    const lastUpdate = moment(cachedData.lastUpdate);
    const nextUpdate = lastUpdate.add(CONFIG.UPDATE_INTERVAL, 'minutes');
    return nextUpdate.format('YYYY-MM-DD HH:mm:ss');
  }

  async grabJSON() {
    return new Promise((resolve, reject) => {
      console.log('[INFO] Grabbing EPG from PlutoTV API...');

      // Verificar cache local (solo si es menor a UPDATE_INTERVAL)
      if (fs.existsSync(CONFIG.CACHE_FILE)) {
        const stat = fs.statSync(CONFIG.CACHE_FILE);
        const now = Date.now() / 1000;
        const mtime = new Date(stat.mtime).getTime() / 1000;
        const cacheAge = (now - mtime) / 60; // minutos

        if (cacheAge < CONFIG.UPDATE_INTERVAL) {
          console.log(`[DEBUG] Using cache.json (${cacheAge.toFixed(1)} minutes old)`);
          try {
            const data = fs.readJSONSync(CONFIG.CACHE_FILE);
            return resolve(data);
          } catch (error) {
            console.log('[WARN] Cache file corrupted, fetching from API...');
          }
        }
      }

      const startTime = encodeURIComponent(
        moment().format('YYYY-MM-DD HH:00:00.000ZZ')
      );
      const stopTime = encodeURIComponent(
        moment().add(CONFIG.EPG_HOURS, 'hours').format('YYYY-MM-DD HH:00:00.000ZZ')
      );

      const url = `${CONFIG.API_URL}?start=${startTime}&stop=${stopTime}`;
      console.log(`[DEBUG] API URL: ${url}`);

      request(url, { timeout: 30000 }, (err, response, body) => {
        if (err) {
          console.error('[ERROR] Failed to fetch from API:', err.message);
          return reject(err);
        }

        if (response.statusCode !== 200) {
          console.error(`[ERROR] API returned status ${response.statusCode}`);
          return reject(new Error(`API returned status ${response.statusCode}`));
        }

        try {
          const data = JSON.parse(body);
          fs.writeFileSync(CONFIG.CACHE_FILE, body);
          console.log('[DEBUG] Cache updated successfully');
          resolve(data);
        } catch (error) {
          console.error('[ERROR] Failed to parse API response:', error.message);
          reject(error);
        }
      });
    });
  }

  generateM3U8(channels) {
    console.log('[INFO] Generating M3U8 playlist...');
    
    let m3u8 = '#EXTM3U\n';
    let count = 0;

    channels.forEach((channel) => {
      if (!channel.isStitched) return;

      try {
        const deviceId = uuid1();
        const sid = uuid4();
        const m3uUrl = new URL(channel.stitched.urls[0].url);
        const params = new URLSearchParams(m3uUrl.search);

        params.set('advertisingId', '');
        params.set('appName', 'web');
        params.set('appVersion', 'unknown');
        params.set('appStoreUrl', '');
        params.set('architecture', '');
        params.set('buildVersion', '');
        params.set('clientTime', '0');
        params.set('deviceDNT', '0');
        params.set('deviceId', deviceId);
        params.set('deviceMake', 'Chrome');
        params.set('deviceModel', 'web');
        params.set('deviceType', 'web');
        params.set('deviceVersion', 'unknown');
        params.set('includeExtendedEvents', 'false');
        params.set('sid', sid);
        params.set('userId', '');
        params.set('serverSideAds', 'true');

        m3uUrl.search = params.toString();

        const slug = channel.slug;
        const logo = channel.colorLogoPNG?.path || '';
        const group = channel.category || 'General';
        const name = channel.name;

        m3u8 += `#EXTINF:0 tvg-id="${slug}" tvg-logo="${logo}" group-title="${group}", ${name}\n${m3uUrl.toString()}\n\n`;
        count++;
      } catch (error) {
        console.error(`[ERROR] Failed to process channel ${channel.name}:`, error.message);
      }
    });

    console.log(`[SUCCESS] Generated M3U8 with ${count} channels`);
    return m3u8;
  }

  generateEPG(channels) {
    console.log('[INFO] Generating EPG XML...');
    
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('tv', { 'generator-info-name': 'plutoIPTV-proxy' });

    let channelCount = 0;
    let programmeCount = 0;

    // Channels
    channels.forEach((channel) => {
      if (!channel.isStitched) return;

      const ch = root.ele('channel', { id: channel.slug });
      ch.ele('display-name').txt(channel.name);
      
      if (channel.colorLogoPNG?.path) {
        ch.ele('icon', { src: channel.colorLogoPNG.path });
      }
      channelCount++;
    });

    // Programmes
    channels.forEach((channel) => {
      if (!channel.isStitched || !channel.timelines) return;

      channel.timelines.forEach((programme) => {
        try {
          const prog = root.ele('programme', {
            start: moment(programme.start).format('YYYYMMDDHHmmss ZZ'),
            stop: moment(programme.stop).format('YYYYMMDDHHmmss ZZ'),
            channel: channel.slug,
          });

          prog.ele('title', { lang: 'es' }).txt(programme.title || 'Sin título');
          prog.ele('desc', { lang: 'es' }).txt(programme.episode?.description || '');
          
          if (programme.episode?.genre) {
            prog.ele('category', { lang: 'es' }).txt(programme.episode.genre);
          }
          
          if (programme.episode?.poster?.path) {
            prog.ele('icon', { src: programme.episode.poster.path });
          }

          programmeCount++;
        } catch (error) {
          console.error(`[ERROR] Failed to process programme in ${channel.name}:`, error.message);
        }
      });
    });

    const epg = root.end({ prettyPrint: true });
    console.log(`[SUCCESS] Generated EPG with ${channelCount} channels and ${programmeCount} programmes`);
    
    return epg;
  }

  async updateData() {
    if (cachedData.isUpdating) {
      console.log('[WARN] Update already in progress, skipping...');
      return;
    }

    cachedData.isUpdating = true;
    console.log('\n========================================');
    console.log('[UPDATE] Starting data update...');
    console.log('========================================');

    try {
      // Obtener datos de la API
      let channels = await this.grabJSON();

      // Aplicar filtro de favoritos si existe
      const favoritesFilter = favorites.from(CONFIG.FAVORITES_PATH);
      if (!favoritesFilter.isEmpty()) {
        channels = channels.filter(favoritesFilter);
        favoritesFilter.printSummary();
      } else {
        console.log(`[DEBUG] No favorites specified, loading all ${channels.length} channels`);
      }

      // Generar M3U8 y EPG
      cachedData.channels = channels;
      cachedData.m3u8 = this.generateM3U8(channels);
      cachedData.epg = this.generateEPG(channels);
      cachedData.lastUpdate = moment().format('YYYY-MM-DD HH:mm:ss');

      // Guardar archivos locales como respaldo
      fs.writeFileSync('playlist.m3u8', cachedData.m3u8);
      fs.writeFileSync('epg.xml', cachedData.epg);

      console.log('[SUCCESS] Data update completed successfully!');
      console.log(`[INFO] Next update in ${CONFIG.UPDATE_INTERVAL} minutes`);
      console.log('========================================\n');

    } catch (error) {
      console.error('[ERROR] Failed to update data:', error.message);
      console.error(error.stack);
    } finally {
      cachedData.isUpdating = false;
    }
  }

  scheduleUpdates() {
    console.log(`[INFO] Scheduling automatic updates every ${CONFIG.UPDATE_INTERVAL} minutes`);
    
    setInterval(() => {
      this.updateData();
    }, CONFIG.UPDATE_INTERVAL * 60 * 1000);
  }

  async start() {
    console.log('\n🛰️  PlutoTV IPTV Proxy Server');
    console.log('=====================================');
    console.log(`Port: ${CONFIG.PORT}`);
    console.log(`Update Interval: ${CONFIG.UPDATE_INTERVAL} minutes`);
    console.log(`EPG Hours: ${CONFIG.EPG_HOURS} hours`);
    console.log('=====================================\n');

    // Actualización inicial
    await this.updateData();

    // Programar actualizaciones automáticas
    this.scheduleUpdates();

    // Iniciar servidor
    this.app.listen(CONFIG.PORT, () => {
      console.log(`\n✅ Server is running on http://localhost:${CONFIG.PORT}`);
      console.log(`📺 M3U8 Playlist: http://localhost:${CONFIG.PORT}/playlist.m3u8`);
      console.log(`📋 EPG Guide: http://localhost:${CONFIG.PORT}/epg.xml`);
      console.log(`📊 Status: http://localhost:${CONFIG.PORT}/status\n`);
    });
  }
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Manejo de señales de terminación
process.on('SIGINT', () => {
  console.log('\n[INFO] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[INFO] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Iniciar servidor
const proxy = new PlutoIPTVProxy();
proxy.start().catch((error) => {
  console.error('[FATAL] Failed to start server:', error);
  process.exit(1);
});

module.exports = PlutoIPTVProxy;