#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ── Parse arguments ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let targetPath = process.cwd();
let since = '6 months ago';
let noOpen = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--since' && args[i + 1]) {
    since = args[++i];
  } else if (args[i] === '--no-open') {
    noOpen = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
  git-calendar — Visualize git history as a calendar heatmap

  Usage:
    git-calendar [path] [options]

  Arguments:
    path              Path to a git repository (default: current directory)

  Options:
    --since <period>  How far back to look (default: "6 months ago")
    --no-open         Don't prompt to open in browser
    -h, --help        Show this help message

  Examples:
    git-calendar
    git-calendar ~/projects/my-repo
    git-calendar . --since "1 year ago"
`);
    process.exit(0);
  } else if (!args[i].startsWith('-')) {
    targetPath = path.resolve(args[i]);
  }
}

// ── Validate git repo ───────────────────────────────────────────────────────
try {
  execSync('git rev-parse --is-inside-work-tree', {
    cwd: targetPath,
    stdio: 'pipe',
  });
} catch {
  console.error(`Error: "${targetPath}" is not inside a git repository.`);
  process.exit(1);
}

const repoRoot = execSync('git rev-parse --show-toplevel', {
  cwd: targetPath,
  encoding: 'utf-8',
}).trim();
const repoName = path.basename(repoRoot);

console.log(`\n  Scanning "${repoName}" since "${since}"...\n`);

// ── Extract git log ─────────────────────────────────────────────────────────
const SEP = '\t';
const gitFormat = ['%h', '%an', '%ae', '%aI', '%s'].join(SEP);

let logOutput;
try {
  logOutput = execSync(
    `git log --all --format="${gitFormat}" --since=${JSON.stringify(since)}`,
    { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  );
} catch {
  logOutput = '';
}

const commits = [];
for (const line of logOutput.split('\n')) {
  if (!line.trim()) continue;
  const parts = line.split(SEP);
  if (parts.length < 5) continue;
  const [hash, author, email, dateIso, ...subjectParts] = parts;
  const subject = subjectParts.join(SEP);
  commits.push({
    hash,
    author,
    email,
    date: dateIso.slice(0, 10),
    time: dateIso.slice(11, 16),
    subject,
  });
}

if (commits.length === 0) {
  console.error(`  No commits found in the last ${since}.`);
  process.exit(1);
}

// ── Build authors list ──────────────────────────────────────────────────────
const authorMap = {};
for (const c of commits) {
  if (!authorMap[c.author]) {
    authorMap[c.author] = { name: c.author, email: c.email, count: 0 };
  }
  authorMap[c.author].count++;
}
const authors = Object.values(authorMap).sort((a, b) => b.count - a.count);

// ── Generate HTML ───────────────────────────────────────────────────────────
const templatePath = path.join(__dirname, '..', 'lib', 'template.html');
let html = fs.readFileSync(templatePath, 'utf-8');

// Use split/join to avoid regex replacement pitfalls with $ in commit messages
html = html.split('__REPO_NAME__').join(escapeHtml(repoName));
html = html.split('__GIT_DATA__').join(JSON.stringify(commits));
html = html.split('__AUTHORS_DATA__').join(JSON.stringify(authors));
html = html.split('__COMMIT_COUNT__').join(String(commits.length));

// ── Write output ────────────────────────────────────────────────────────────
const outputDir = path.join(os.homedir(), '.git-calendar');
fs.mkdirSync(outputDir, { recursive: true });

const outputFile = path.join(outputDir, `${sanitize(repoName)}.html`);
fs.writeFileSync(outputFile, html);

const uniqueAuthors = authors.length;
const dateRange = commits.map(c => c.date).sort();
const firstDate = dateRange[0];
const lastDate = dateRange[dateRange.length - 1];

console.log(`  ${commits.length} commits from ${uniqueAuthors} contributors`);
console.log(`  ${firstDate} to ${lastDate}\n`);
console.log(`  Generated: file://${outputFile}\n`);

// ── Prompt to open ──────────────────────────────────────────────────────────
if (noOpen) {
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('  Press Enter to open in browser (or q to quit): ', (answer) => {
  rl.close();
  if (answer.trim().toLowerCase() === 'q') {
    process.exit(0);
  }
  openBrowser(outputFile);
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function openBrowser(filePath) {
  const url = `file://${filePath}`;
  let cmd, args;

  switch (process.platform) {
    case 'darwin':
      cmd = 'open';
      args = [url];
      break;
    case 'win32':
      cmd = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    default:
      cmd = 'xdg-open';
      args = [url];
      break;
  }

  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
