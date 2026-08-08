const fs = require('fs');
const path = require('path');
const { parseFile } = require('music-metadata');

const musDir = path.join(__dirname, 'mus');
const outputFile = path.join(__dirname, 'songs.json');

// Formatos de audio soportados
const SUPPORTED_FORMATS = ['.mp3', '.flac', '.opus', '.ogg', '.wav', '.m4a'];

// Especificar qué imagen usar para cada canción con easter egg
const easterEggImages = {
  'Ancient Aliens.mp3': 'mus/NC.jpeg',
  'No Eyed Girl.mp3': 'mus/NC.jpeg',
  'The HuMaN Gala.mp3': 'mus/The HuMaN Galap.jpeg',
};

// Temas visuales: mapeo de palabra clave en comentario → nombre de tema
// También se puede detectar por título/nombre de archivo si el comentario tiene THEME:<nombre>
// Ejemplo en comentario del MP3: THEME:agartha
// Si no hay comentario, se detecta automáticamente por título/nombre de archivo
const autoThemeRules = [
  { pattern: /down under/i, theme: 'agartha' },
];

function extractCommentText(common) {
  if (!common.comment) return '';
  if (Array.isArray(common.comment)) {
    const first = common.comment[0];
    if (typeof first === 'string') return first;
    if (typeof first === 'object') return first.text || Object.values(first).join(' ');
  }
  if (typeof common.comment === 'string') return common.comment;
  if (typeof common.comment === 'object') return common.comment.text || Object.values(common.comment).join(' ');
  return '';
}

async function generateSongs() {
  try {
    const files = fs.readdirSync(musDir).filter(file =>
      SUPPORTED_FORMATS.includes(path.extname(file).toLowerCase())
    );
    const songs = [];

    console.log(`📂 Encontradas ${files.length} canciones en mus/\n`);

    for (const file of files) {
      const filePath = path.join(musDir, file);
      const songObj = { src: `mus/${file}` };

      try {
        const metadata = await parseFile(filePath);
        const common = metadata.common || {};

        // Extraer metadatos
        songObj.title = common.title || file.replace(/\.[^/.]+$/, '');
        songObj.artist = common.artist || 'Artista desconocido';
        songObj.album = common.album || 'Álbum desconocido';
        songObj.year = common.year ? String(common.year) : 'Año desconocido';
        songObj.image = 'mus/favicon1.png';

        const comments = extractCommentText(common);

        console.log(`🎵 ${songObj.title}`);
        console.log(`   👤 ${songObj.artist} | 💿 ${songObj.album}`);

        // ── Easter Egg ──────────────────────────────────────────────────────
        if (comments && comments.includes('EASTER_EGG')) {
          let imagePath;
          if (easterEggImages[file]) {
            imagePath = path.join(musDir, easterEggImages[file].replace('mus/', ''));
            songObj.easterEgg = easterEggImages[file];
          } else {
            const baseName = file.replace(/\.[^/.]+$/, '.jpeg');
            imagePath = path.join(musDir, baseName);
            songObj.easterEgg = `mus/${baseName}`;
          }
          if (fs.existsSync(imagePath)) {
            console.log(`   🎨 Easter egg encontrado`);
          } else {
            console.log(`   ⚠️  Easter egg especificado pero imagen no existe`);
            delete songObj.easterEgg;
          }
        }

        // ── Tema visual ─────────────────────────────────────────────────────
        // Prioridad 1: comentario explícito THEME:<nombre>
        const themeFromComment = comments.match(/THEME:(\w+)/i);
        if (themeFromComment) {
          songObj.theme = themeFromComment[1].toLowerCase();
          console.log(`   🎨 Tema visual por comentario: ${songObj.theme}`);
        } else {
          // Prioridad 2: detección automática por título o nombre de archivo
          const searchStr = (songObj.title + ' ' + file).toLowerCase();
          for (const rule of autoThemeRules) {
            if (rule.pattern.test(searchStr)) {
              songObj.theme = rule.theme;
              console.log(`   🎨 Tema visual auto-detectado: ${songObj.theme}`);
              break;
            }
          }
        }

      } catch (e) {
        console.log(`⚠️  ${file} - Error al leer metadatos: ${e.message}`);
        songObj.title = file.replace(/\.[^/.]+$/, '');
        songObj.artist = 'Artista desconocido';
        songObj.album = 'Álbum desconocido';
        songObj.year = 'Año desconocido';
        songObj.image = 'mus/favicon1.png';
      }

      songs.push(songObj);
    }

    // Ordenar alfabéticamente
    songs.sort((a, b) => a.src.localeCompare(b.src));

    fs.writeFileSync(outputFile, JSON.stringify(songs, null, 2));

    console.log(`\n✨ songs.json generado exitosamente`);
    console.log(`✅ Total: ${songs.length} canciones\n`);

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

generateSongs();
