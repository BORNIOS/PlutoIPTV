const fs = require('fs-extra');

/**
 * Módulo para filtrar canales favoritos
 */
class FavoritesFilter {
  constructor(favoritesPath) {
    this.favoritesPath = favoritesPath;
    this.favorites = [];
    this.loadFavorites();
  }

  loadFavorites() {
    if (!fs.existsSync(this.favoritesPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.favoritesPath, 'utf8');
      
      // Soportar diferentes formatos:
      // 1. Lista de IDs separados por líneas
      // 2. JSON array
      // 3. Texto con IDs separados por comas
      
      if (content.trim().startsWith('[')) {
        // Formato JSON
        this.favorites = JSON.parse(content);
      } else {
        // Formato texto: líneas o comas
        this.favorites = content
          .split(/[\n,]/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));
      }

      console.log(`[INFO] Loaded ${this.favorites.length} favorites from ${this.favoritesPath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to load favorites from ${this.favoritesPath}:`, error.message);
    }
  }

  isEmpty() {
    return this.favorites.length === 0;
  }

  filter(channel) {
    if (this.isEmpty()) {
      return true;
    }

    // Buscar por slug, ID o nombre
    return this.favorites.some(fav => {
      const favLower = fav.toLowerCase();
      return (
        channel.slug?.toLowerCase() === favLower ||
        channel._id?.toLowerCase() === favLower ||
        channel.id?.toLowerCase() === favLower ||
        channel.name?.toLowerCase() === favLower ||
        channel.slug?.toLowerCase().includes(favLower) ||
        channel.name?.toLowerCase().includes(favLower)
      );
    });
  }

  printSummary() {
    if (this.isEmpty()) {
      console.log('[INFO] No favorites filter applied');
      return;
    }

    console.log('========================================');
    console.log('[INFO] Favorites Filter Active');
    console.log(`[INFO] Filtering for ${this.favorites.length} favorite(s):`);
    this.favorites.forEach((fav, index) => {
      console.log(`  ${index + 1}. ${fav}`);
    });
    console.log('========================================');
  }
}

/**
 * Factory function para crear un filtro de favoritos
 */
function from(favoritesPath) {
  return new FavoritesFilter(favoritesPath);
}

module.exports = {
  from,
  FavoritesFilter
};