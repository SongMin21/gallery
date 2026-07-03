// assets/images/ 안의 day 폴더들을 스캔해서 assets/manifest.json을 만듭니다.
// 사용법: node scripts/generate-manifest.js
// (Node.js 내장 모듈만 사용 — 별도 설치 불필요)

const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images');
const OUTPUT = path.join(__dirname, '..', 'assets', 'manifest.json');

// 인식할 이미지 확장자
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);

// dayNN 형태의 폴더만 대상 (day 뒤에 숫자). 다른 폴더도 포함하려면 이 정규식을 수정
const DAY_PATTERN = /^day\d+$/i;

function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error('폴더가 없습니다:', IMAGES_DIR);
    process.exit(1);
  }

  const days = fs
    .readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && DAY_PATTERN.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => {
      // day2 < day10 처럼 숫자 기준 정렬
      const na = parseInt(a.replace(/\D/g, ''), 10);
      const nb = parseInt(b.replace(/\D/g, ''), 10);
      return na - nb;
    })
    .map((folder) => {
      const dir = path.join(IMAGES_DIR, folder);
      const images = fs
        .readdirSync(dir)
        .filter((f) => EXTS.has(path.extname(f).toLowerCase()))
        .sort()
        .map((f) => `assets/images/${folder}/${f}`);

      return {
        id: folder,
        title: folder.toUpperCase(), // 표지 제목: DAY01
        count: images.length,
        images,
      };
    })
    .filter((day) => day.count > 0); // 빈 폴더는 제외

  const manifest = {
    generated: new Date().toISOString(),
    days,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `manifest.json 생성 완료 — ${days.length}개 폴더, 총 ${days.reduce((s, d) => s + d.count, 0)}장`,
  );
  days.forEach((d) => console.log(`  ${d.id}: ${d.count}장`));
}

main();
