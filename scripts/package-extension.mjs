import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { compile } from 'sass';

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const distDir = join(rootDir, 'dist');
const sourceManifestPath = join(rootDir, 'manifest.json');
const packageJsonPath = join(rootDir, 'package.json');
const resvgWasmPath = join(rootDir, 'node_modules/@resvg/resvg-wasm/index_bg.wasm');
const target = process.argv[2];
const targets = target === 'all' ? ['chrome', 'firefox'] : [target];
const filesToPackage = [
  'manifest.json',
  'src/content/giphy-markdown-link.js',
];
const assetsToGenerate = [
  { size: 16, path: 'assets/icons/icon16.png' },
  { size: 32, path: 'assets/icons/icon32.png' },
  { size: 64, path: 'assets/icons/icon64.png' },
  { size: 128, path: 'assets/icons/icon128.png' },
  { size: 512, path: 'assets/images/logo512.png' },
];
const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

if (!target || !['chrome', 'firefox', 'all'].includes(target)) {
  console.error('Usage: node scripts/package-extension.mjs <chrome|firefox|all>');
  process.exit(1);
}

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const manifest = JSON.parse(await readFile(sourceManifestPath, 'utf8'));
await initWasm(await readFile(resvgWasmPath));
const version = manifest.version ?? packageJson.version;
const packageBaseName = `${packageJson.name}-${version}`;

await mkdir(distDir, { recursive: true });

for (const browser of targets) {
  const browserDistDir = join(distDir, browser);
  const zipPath = join(distDir, `${packageBaseName}-${browser}.zip`);

  await rm(browserDistDir, { recursive: true, force: true });
  await rm(zipPath, { force: true });
  await mkdir(browserDistDir, { recursive: true });

  for (const file of filesToPackage) {
    if (file === 'manifest.json') {
      continue;
    }

    await mkdir(dirname(join(browserDistDir, file)), { recursive: true });
    await cp(join(rootDir, file), join(browserDistDir, file), { recursive: true });
  }

  await generateAssets(browserDistDir);
  await compileScss(browserDistDir);

  const browserManifest = { ...manifest };
  if (browser === 'chrome') {
    delete browserManifest.browser_specific_settings;
  }

  await writeFile(
    join(browserDistDir, 'manifest.json'),
    `${JSON.stringify(browserManifest, null, 2)}\n`,
  );

  await zipDirectory(browserDistDir, zipPath);
  console.log(`Created ${relativeToRoot(zipPath)}`);
}

async function compileScss(outputRootDir) {
  const sourcePath = join(rootDir, 'src/content/giphy-markdown-link.scss');
  const outputPath = join(outputRootDir, 'src/content/giphy-markdown-link.css');
  const result = compile(sourcePath, { style: 'expanded' });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.css);
}

async function generateAssets(outputRootDir) {
  const sourceSvg = join(rootDir, 'src/logo.svg');
  const svg = await readFile(sourceSvg);

  for (const asset of assetsToGenerate) {
    const outputPath = join(outputRootDir, asset.path);
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: asset.size,
      },
    });
    const png = resvg.render();

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, png.asPng());

    png.free();
    resvg.free();
  }
}

async function zipDirectory(sourceDir, zipPath) {
  const entries = await collectFiles(sourceDir);
  const output = createWriteStream(zipPath);
  const centralDirectory = [];
  let offset = 0;

  for (const entry of entries) {
    const data = await readFile(entry.absolutePath);
    const compressedData = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const nameBuffer = Buffer.from(entry.zipPath);
    const localHeader = createLocalFileHeader(nameBuffer, crc, compressedData.length, data.length);

    output.write(localHeader);
    output.write(nameBuffer);
    output.write(compressedData);

    centralDirectory.push({
      nameBuffer,
      crc,
      compressedSize: compressedData.length,
      uncompressedSize: data.length,
      offset,
    });

    offset += localHeader.length + nameBuffer.length + compressedData.length;
  }

  const centralDirectoryOffset = offset;

  for (const entry of centralDirectory) {
    const centralHeader = createCentralDirectoryHeader(entry);
    output.write(centralHeader);
    output.write(entry.nameBuffer);
    offset += centralHeader.length + entry.nameBuffer.length;
  }

  const centralDirectorySize = offset - centralDirectoryOffset;
  output.write(createEndOfCentralDirectory(centralDirectory.length, centralDirectorySize, centralDirectoryOffset));

  await new Promise((resolve, reject) => {
    output.end(resolve);
    output.on('error', reject);
  });
}

async function collectFiles(sourceDir, currentDir = sourceDir) {
  const directoryEntries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const directoryEntry of directoryEntries) {
    const absolutePath = join(currentDir, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      files.push(...await collectFiles(sourceDir, absolutePath));
      continue;
    }

    if (!directoryEntry.isFile()) {
      continue;
    }

    const relativePath = absolutePath.slice(sourceDir.length + 1).split('/').join(posix.sep);
    files.push({ absolutePath, zipPath: relativePath });
  }

  return files.sort((a, b) => a.zipPath.localeCompare(b.zipPath));
}

function createLocalFileHeader(nameBuffer, crc, compressedSize, uncompressedSize) {
  const buffer = Buffer.alloc(30);
  buffer.writeUInt32LE(0x04034b50, 0);
  buffer.writeUInt16LE(20, 4);
  buffer.writeUInt16LE(0x0800, 6);
  buffer.writeUInt16LE(8, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt32LE(crc, 14);
  buffer.writeUInt32LE(compressedSize, 18);
  buffer.writeUInt32LE(uncompressedSize, 22);
  buffer.writeUInt16LE(nameBuffer.length, 26);
  buffer.writeUInt16LE(0, 28);
  return buffer;
}

function createCentralDirectoryHeader(entry) {
  const buffer = Buffer.alloc(46);
  buffer.writeUInt32LE(0x02014b50, 0);
  buffer.writeUInt16LE(0x0314, 4);
  buffer.writeUInt16LE(20, 6);
  buffer.writeUInt16LE(0x0800, 8);
  buffer.writeUInt16LE(8, 10);
  buffer.writeUInt16LE(0, 12);
  buffer.writeUInt16LE(0, 14);
  buffer.writeUInt32LE(entry.crc, 16);
  buffer.writeUInt32LE(entry.compressedSize, 20);
  buffer.writeUInt32LE(entry.uncompressedSize, 24);
  buffer.writeUInt16LE(entry.nameBuffer.length, 28);
  buffer.writeUInt16LE(0, 30);
  buffer.writeUInt16LE(0, 32);
  buffer.writeUInt16LE(0, 34);
  buffer.writeUInt16LE(0, 36);
  buffer.writeUInt32LE(0, 38);
  buffer.writeUInt32LE(entry.offset, 42);
  return buffer;
}

function createEndOfCentralDirectory(entryCount, centralDirectorySize, centralDirectoryOffset) {
  const buffer = Buffer.alloc(22);
  buffer.writeUInt32LE(0x06054b50, 0);
  buffer.writeUInt16LE(0, 4);
  buffer.writeUInt16LE(0, 6);
  buffer.writeUInt16LE(entryCount, 8);
  buffer.writeUInt16LE(entryCount, 10);
  buffer.writeUInt32LE(centralDirectorySize, 12);
  buffer.writeUInt32LE(centralDirectoryOffset, 16);
  buffer.writeUInt16LE(0, 20);
  return buffer;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function relativeToRoot(path) {
  return path.slice(rootDir.length + 1);
}
