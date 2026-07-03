// assets/images/ 안의 PNG/JPG 이미지를 WebP로 변환하고
// manifest.json의 경로도 .webp로 업데이트합니다.
// CI에서 배포 전에 실행합니다.
//
// 사용법: node scripts/optimize-images.js
// 필요: npm install sharp

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images');
const MANIFEST = path.join(__dirname, '..', 'assets', 'manifest.json');

const MAX_WIDTH = 1600;
const QUALITY = 80;
const SOURCE_EXTS = new Set(['.png', '.jpg', '.jpeg']);

async function convertFile(src) {
  const ext = path.extname(src).toLowerCase();
  if (!SOURCE_EXTS.has(ext)) return null;

  const dest = src.replace(/\.(png|jpe?g)$/i, '.webp');

  await sharp(src)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(dest);

  const srcSize = fs.statSync(src).size;
  const destSize = fs.statSync(dest).size;
  fs.unlinkSync(src);

  return {
    from: path.basename(src),
    to: path.basename(dest),
    saved: srcSize - destSize,
  };
}

async function main() {
  const days = fs
    .readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  let total = 0;
  let savedBytes = 0;

  for (const day of days) {
    const dir = path.join(IMAGES_DIR, day.name);
    const files = fs.readdirSync(dir).map((f) => path.join(dir, f));

    for (const file of files) {
      const result = await convertFile(file);
      if (result) {
        total++;
        savedBytes += result.saved;
        console.log(`  ${result.from} → ${result.to}`);
      }
    }
  }

  // manifest.json 경로 업데이트
  if (fs.existsSync(MANIFEST)) {
    let json = fs.readFileSync(MANIFEST, 'utf-8');
    json = json.replace(/\.(png|jpe?g)"/gi, '.webp"');
    fs.writeFileSync(MANIFEST, json);
    console.log('\nmanifest.json 경로 업데이트 완료');
  }

  console.log(
    `\n완료: ${total}개 변환, ${(savedBytes / 1024 / 1024).toFixed(1)}MB 절감`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
