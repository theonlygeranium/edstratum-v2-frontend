import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST_DIR = new URL('../dist/', import.meta.url)
const DIST_PATH = DIST_DIR.pathname
const REPO_DIR = fileURLToPath(new URL('..', import.meta.url))
const PRODUCTION_BACKEND_URL = 'https://stratum-backend-production-a340.up.railway.app'

function fromGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

function publicPath(path) {
  return `/${relative(DIST_PATH, path).split('/').join('/')}`
}

function collectAssets() {
  return walkFiles(join(DIST_PATH, 'assets'))
    .map((path) => ({
      path: publicPath(path),
      fileName: basename(path),
      bytes: statSync(path).size,
      sha256: sha256(path),
    }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function firstAsset(assets, pattern) {
  return assets.find((asset) => pattern.test(asset.fileName))?.path ?? null
}

const assets = collectAssets()
const commitSha =
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  fromGit(['rev-parse', 'HEAD']) ||
  'unknown'
const branch =
  process.env.CF_PAGES_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  fromGit(['branch', '--show-current']) ||
  'unknown'
const backendUrl = (process.env.VITE_STRATUM_API_URL || PRODUCTION_BACKEND_URL)
  .trim()
  .replace(/\/+$/, '')

const manifest = {
  schemaVersion: 1,
  app: 'edstratum-v2-frontend',
  builtAt: new Date().toISOString(),
  commitSha,
  commitShortSha: commitSha === 'unknown' ? 'unknown' : commitSha.slice(0, 7),
  branch,
  backendUrl,
  assets,
  entryAsset: firstAsset(assets, /^index-[\w-]+\.js$/),
  stylesheetAsset: firstAsset(assets, /^index-[\w-]+\.css$/),
  chatAsset: firstAsset(assets, /^StratumChat-[\w-]+\.js$/),
  pdfAssets: assets
    .filter((asset) => /^(stratumPDF|pdf-vendor)-[\w-]+\.js$/.test(asset.fileName))
    .map((asset) => asset.path),
}

writeFileSync(
  join(DIST_PATH, 'build-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

console.log(
  `build-manifest.json: ${manifest.commitShortSha} ${assets.length} assets`,
)
