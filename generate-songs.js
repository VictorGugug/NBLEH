const fs = require('fs');
const path = require('path');
const { parseFile } = require('music-metadata');

const musDir = path.join(__dirname, 'mus');
const songsDir = path.join(musDir, 'songs');
const lyricsDir = path.join(musDir, 'lyrics');
const outputFile = path.join(__dirname, 'songs.json');

const SUPPORTED_FORMATS = ['.mp3', '.flac', '.opus', '.ogg', '.wav', '.m4a'];

const easterEggImages = {
  'Ancient Aliens.mp3': 'mus/NC.jpeg',
  'No Eyed Girl.mp3': 'mus/NC.jpeg',
  'The HuMaN Gala.mp3': 'mus/The HuMaN Galap.jpeg',
};

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

function normalizeLyricKey(s) {
  return s
    .replace(/\.(ttml|lrc|lcr)$/i, '')
    .replace(/[\u201c\u201d\uff02"'`]/g, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findLyrics(baseName, artist, title) {
  let files;
  try {
    files = fs.readdirSync(lyricsDir);
  } catch (e) {
    return undefined;
  }

  const wanted = new Set([baseName, artist + ' - ' + title, title].map(normalizeLyricKey));
  const hits = files.filter(f => wanted.has(normalizeLyricKey(f)));

  const ttml = hits.find(f => f.toLowerCase().endsWith('.ttml'));
  const lrc = hits.find(f => f.toLowerCase().endsWith('.lrc'));

  let ttmlFile = ttml;
  if (!ttmlFile) {
    const baseKey = normalizeLyricKey(baseName);
    const prefixed = files
      .filter(f => f.toLowerCase().endsWith('.ttml'))
      .map(f => ({ f, k: normalizeLyricKey(f) }))
      .filter(x => x.k.startsWith(baseKey + ' '))
      .sort((a, b) => b.k.length - a.k.length);
    if (prefixed.length) ttmlFile = prefixed[0].f;
  }

  if (!ttmlFile && !lrc) return undefined;

  const out = {};
  if (ttmlFile) out.ttml = 'mus/lyrics/' + ttmlFile;
  if (lrc) out.lrc = 'mus/lyrics/' + lrc;
  return out;
}

async function generateSongs() {
  try {
    const files = fs.readdirSync(songsDir).filter(file =>
      SUPPORTED_FORMATS.includes(path.extname(file).toLowerCase())
    );
    const songs = [];

    console.log(`📂 Encontradas ${files.length} canciones en mus/songs/\n`);

    for (const file of files) {
      const filePath = path.join(songsDir, file);
      const songObj = { src: `mus/songs/${file}` };

      try {
        const metadata = await parseFile(filePath);
        const common = metadata.common || {};

        songObj.title = common.title || file.replace(/\.[^/.]+$/, '');
        songObj.artist = common.artist || 'Artista desconocido';
        songObj.album = common.album || 'Álbum desconocido';
        songObj.year = common.year ? String(common.year) : 'Año desconocido';
        songObj.image = 'mus/favicon1.png';

        const comments = extractCommentText(common);

        console.log(`🎵 ${songObj.title}`);
        console.log(`   👤 ${songObj.artist} | 💿 ${songObj.album}`);

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

        const themeFromComment = comments.match(/THEME:(\w+)/i);
        if (themeFromComment) {
          songObj.theme = themeFromComment[1].toLowerCase();
          console.log(`   🎨 Tema visual por comentario: ${songObj.theme}`);
        } else {
          const searchStr = (songObj.title + ' ' + file).toLowerCase();
          for (const rule of autoThemeRules) {
            if (rule.pattern.test(searchStr)) {
              songObj.theme = rule.theme;
              console.log(`   🎨 Tema visual auto-detectado: ${songObj.theme}`);
              break;
            }
          }
        }

        const baseName = file.replace(/\.[^/.]+$/, '');
        const lyrics = findLyrics(baseName, songObj.artist, songObj.title);
        if (lyrics) {
          songObj.lyrics = lyrics;
          const kinds = [];
          if (lyrics.ttml) kinds.push('TTML');
          if (lyrics.lrc) kinds.push('LRC');
          console.log(`   🎤 Letras: ${kinds.join(' + ')}`);
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
