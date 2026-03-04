#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const requiredEnv = ['CDN_S3_ACCESS_KEY', 'CDN_S3_SECRET_KEY', 'CDN_S3_BUCKET'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[deploy:cdn] Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const {
  CDN_S3_ACCESS_KEY,
  CDN_S3_SECRET_KEY,
  CDN_S3_BUCKET,
  CDN_S3_REGION = 'us-east-1',
  CDN_S3_ENDPOINT,
  CDN_S3_FORCE_PATH_STYLE,
  CDN_S3_CLEAR,
  CDN_CF_ZONE_ID,
  CDN_CF_TOKEN,
  CDN_CF_PURGE_PATHS,
  CDN_CF_PURGE_EVERYTHING
} = process.env;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csmaDir = path.resolve(__dirname, '..', '..');
const distDir = path.join(csmaDir, 'dist');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    console.error(`[deploy:cdn] Command failed: ${command} ${args.join(' ')}`);
    process.exit(result.status || 1);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.js': return 'application/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    case '.txt': return 'text/plain';
    case '.map': return 'application/json';
    case '.wasm': return 'application/wasm';
    default: return 'application/octet-stream';
  }
}

function getCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext || ext === '.html' || ext === '.json') {
    return 'public, max-age=60';
  }
  return 'public, max-age=31536000, immutable';
}

async function collectFiles(dir, prefix = '') {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    const rel = path.posix.join(prefix, entry);
    const stats = await stat(absolute);
    if (stats.isDirectory()) {
      const nested = await collectFiles(absolute, rel);
      files.push(...nested);
    } else {
      files.push({ absolute, key: rel });
    }
  }
  return files;
}

async function emptyBucket(client) {
  let token;
  do {
    const list = await client.send(new ListObjectsV2Command({ Bucket: CDN_S3_BUCKET, ContinuationToken: token }));
    if (list.Contents && list.Contents.length) {
      const deleteParams = {
        Bucket: CDN_S3_BUCKET,
        Delete: { Objects: list.Contents.map((object) => ({ Key: object.Key })) }
      };
      await client.send(new DeleteObjectsCommand(deleteParams));
    }
    token = list.NextContinuationToken;
  } while (token);
}

async function uploadFiles(client, files) {
  for (const file of files) {
    const key = file.key.replace(/\\/g, '/');
    const command = new PutObjectCommand({
      Bucket: CDN_S3_BUCKET,
      Key: key,
      Body: createReadStream(file.absolute),
      ContentType: getContentType(key),
      CacheControl: getCacheControl(key)
    });
    await client.send(command);
    console.log(`[deploy:cdn] Uploaded ${key}`);
  }
}

async function purgeCloudflare(paths) {
  if (!CDN_CF_TOKEN || !CDN_CF_ZONE_ID) {
    return;
  }

  const shouldPurgeAll = CDN_CF_PURGE_EVERYTHING === 'true' || !paths.length;
  const body = shouldPurgeAll ? { purge_everything: true } : { files: paths };

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CDN_CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CDN_CF_TOKEN}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    console.error('[deploy:cdn] Cloudflare purge failed', await response.text());
    process.exit(1);
  }
  console.log('[deploy:cdn] Cloudflare cache purged');
}

(async () => {
  console.log('[deploy:cdn] Building CSMA hybrid bundle');
  run('npm', ['run', 'build:hybrid'], { cwd: csmaDir });

  const s3Config = {
    region: CDN_S3_REGION,
    credentials: {
      accessKeyId: CDN_S3_ACCESS_KEY,
      secretAccessKey: CDN_S3_SECRET_KEY
    }
  };
  if (CDN_S3_ENDPOINT) {
    s3Config.endpoint = CDN_S3_ENDPOINT;
    s3Config.forcePathStyle = CDN_S3_FORCE_PATH_STYLE === 'true';
  }

  const client = new S3Client(s3Config);

  if (CDN_S3_CLEAR === 'true') {
    console.log('[deploy:cdn] Clearing bucket before upload');
    await emptyBucket(client);
  }

  const files = await collectFiles(distDir);
  console.log(`[deploy:cdn] Uploading ${files.length} files to ${CDN_S3_BUCKET}`);
  await uploadFiles(client, files);

  const purgePaths = (CDN_CF_PURGE_PATHS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  await purgeCloudflare(purgePaths);

  console.log('[deploy:cdn] Deployment complete');
})();
