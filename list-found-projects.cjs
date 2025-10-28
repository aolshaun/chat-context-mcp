const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'Library/Application Support/Cursor/User/globalStorage/state.vscdb'
);

const db = new Database(dbPath, { readonly: true });

const projectPaths = new Set();

function extractFilePaths(obj, paths) {
  if (typeof obj === 'string') {
    // Check if it looks like a file path
    if (obj.includes('/play/') || obj.includes('/Documents/') || obj.includes('file:///')) {
      paths.add(obj);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach(item => extractFilePaths(item, paths));
    return;
  }
  if (obj !== null && typeof obj === 'object') {
    Object.values(obj).forEach(value => extractFilePaths(value, paths));
  }
}

function extractProjectName(filePath) {
  // Remove file:// prefix
  let cleanPath = filePath.replace(/^file:\/\//, '');
  
  // Common patterns
  const patterns = [
    /\/play\/([^\/]+)/,
    /\/Documents\/([^\/]+)/,
    /\/projects\/([^\/]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = cleanPath.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

const stmt = db.prepare('SELECT value FROM cursorDiskKV WHERE key LIKE \'composerData:%\'');

let processed = 0;
for (const row of stmt.iterate()) {
  try {
    const composerData = JSON.parse(row.value);
    const paths = new Set();
    extractFilePaths(composerData, paths);
    
    for (const p of paths) {
      projectPaths.add(p);
    }
    
    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`\rProcessed ${processed} sessions...`);
    }
  } catch (err) {}
}

console.log(`\n\nExtracted ${projectPaths.size} unique file paths`);
console.log('\n📁 FOUND PROJECTS:\n');

const projects = new Map(); // project name -> count

for (const filePath of projectPaths) {
  const project = extractProjectName(filePath);
  if (project) {
    projects.set(project, (projects.get(project) || 0) + 1);
  }
}

// Sort by count
const sorted = Array.from(projects.entries())
  .sort((a, b) => b[1] - a[1]);

for (const [project, count] of sorted) {
  console.log(`${project.padEnd(40)} → ${count} file references`);
}

console.log(`\nTotal unique projects: ${projects.size}`);

db.close();
