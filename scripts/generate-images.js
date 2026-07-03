// 영어 문장 목록을 읽어 TOEIC Speaking Part 2(사진 묘사) 스타일 이미지를
// 한 문장당 한 장씩 생성해 day 폴더에 저장합니다.
//
// 사용법:
//   1. sentences.txt에 한 줄에 한 문장씩 작성
//   2. 환경변수로 API 키 설정:  export GEMINI_API_KEY=발급받은키
//      (Windows PowerShell:  $env:GEMINI_API_KEY="발급받은키")
//   3. 실행:  node scripts/generate-images.js day03
//      (다른 문장 파일 사용:  node scripts/generate-images.js day03 my-sentences.txt)
//
// 특징:
//   - 이미 생성된 파일은 건너뜀 → 중간에 끊겨도 다시 실행하면 이어서 생성
//   - 호출 사이 딜레이로 rate limit 회피
//   - 끝나면 generate-manifest.js를 실행해 갤러리에 반영하세요.

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const DELAY_MS = 3000; // 호출 간격 (rate limit 대비)

// TOEIC Part 2 사진 묘사용 프롬프트 틀
// 실사 스톡포토 느낌 + 글자/워터마크 없음 + 묘사할 거리가 있는 구도
function buildPrompt(sentence) {
  return [
    'A realistic candid stock photograph for an English speaking test',
    '(picture description task). The photo depicts this scene:',
    `"${sentence}"`,
    'Requirements: natural lighting, everyday setting, 2-4 people visible',
    'when the sentence involves people, clear foreground and background,',
    'no text, no watermark, no logos, 4:3 aspect ratio, photorealistic.',
  ].join(' ');
}

// 파일명용 슬러그: "A man is ordering coffee." → a_man_is_ordering_coffee
function slugify(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6) // 앞 6단어까지만
    .join('_');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generateOne(sentence) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(sentence) }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error('응답에 이미지가 없습니다 (안전 필터에 걸렸을 수 있음)');
  }
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

async function main() {
  const dayId = process.argv[2];
  const sentencesFile = process.argv[3] || 'sentences.txt';

  if (!dayId || !/^day\d+$/i.test(dayId)) {
    console.error('사용법: node scripts/generate-images.js day03 [sentences.txt]');
    process.exit(1);
  }
  if (!API_KEY) {
    console.error('GEMINI_API_KEY 환경변수를 설정해 주세요.');
    console.error('키 발급: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  const sentencesPath = path.resolve(sentencesFile);
  if (!fs.existsSync(sentencesPath)) {
    console.error('문장 파일이 없습니다:', sentencesPath);
    process.exit(1);
  }

  const sentences = fs
    .readFileSync(sentencesPath, 'utf-8')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const outDir = path.join(__dirname, '..', 'assets', 'images', dayId.toLowerCase());
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`${sentences.length}개 문장 → ${outDir}`);

  let ok = 0,
    skip = 0,
    fail = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const no = String(i + 1).padStart(2, '0');
    const filename = `${no}_${slugify(sentence)}.png`;
    const outPath = path.join(outDir, filename);

    // 이미 있으면 건너뛰기 (재실행 시 이어서 생성)
    if (fs.existsSync(outPath)) {
      console.log(`[${no}] 건너뜀 (이미 존재): ${filename}`);
      skip++;
      continue;
    }

    process.stdout.write(`[${no}] 생성 중: "${sentence}" ... `);
    try {
      const buf = await generateOne(sentence);
      fs.writeFileSync(outPath, buf);
      console.log(`저장됨 (${Math.round(buf.length / 1024)}KB)`);
      ok++;
    } catch (e) {
      console.log('실패 —', e.message);
      fail++;
    }

    if (i < sentences.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n완료: 생성 ${ok} / 건너뜀 ${skip} / 실패 ${fail}`);
  if (fail > 0) {
    console.log('실패한 항목은 같은 명령을 다시 실행하면 그것만 다시 시도합니다.');
  }
  console.log('갤러리 반영: node scripts/generate-manifest.js');
}

main();
