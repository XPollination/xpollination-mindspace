const Database = require('better-sqlite3');
const fs = require('fs');

const projects = [
  { name: 'xpollination-mcp-server', path: '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db' },
  { name: 'HomePage', path: '/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db' }
];

const WORK_FILE = '/tmp/dev-work-found.json';
const POLL_INTERVAL = 30000; // 30 seconds

function checkProjects() {
  const timestamp = new Date().toLocaleTimeString();
  let devTasks = [];

  projects.forEach(project => {
    try {
      const db = new Database(project.path, { readonly: true });

      const tasks = db.prepare(`
        SELECT slug, type, status,
               json_extract(dna_json, '$.title') as title
        FROM mindspace_nodes
        WHERE status = 'ready' AND dna_json LIKE '%role":"dev%'
      `).all();

      if (tasks.length > 0) {
        tasks.forEach(t => {
          devTasks.push({project: project.name, slug: t.slug, type: t.type, title: t.title});
        });
      }

      db.close();
    } catch (err) {
      console.log(`[${timestamp}] [${project.name}] Error: ${err.message}`);
    }
  });

  if (devTasks.length > 0) {
    console.log(`[${timestamp}] WORK FOUND: ${devTasks.length} DEV item(s)`);
    devTasks.forEach(t => console.log(`  - [${t.project}] ${t.slug} (${t.type}): ${t.title || '(no title)'}`));

    // Write work file for Claude to pick up
    fs.writeFileSync(WORK_FILE, JSON.stringify({
      found_at: new Date().toISOString(),
      tasks: devTasks
    }, null, 2));
  } else {
    console.log(`[${timestamp}] No DEV tasks`);
    // Remove work file if no tasks
    if (fs.existsSync(WORK_FILE)) {
      fs.unlinkSync(WORK_FILE);
    }
  }

  return devTasks;
}

// Check if running in standalone mode (with --loop flag)
if (process.argv.includes('--loop')) {
  console.log('Starting DEV monitor in standalone mode...');
  console.log(`Projects: ${projects.map(p => p.name).join(', ')}`);
  console.log(`Poll interval: ${POLL_INTERVAL/1000}s`);
  console.log(`Work file: ${WORK_FILE}`);
  console.log('---');

  // Initial check
  checkProjects();

  // Continuous polling
  setInterval(checkProjects, POLL_INTERVAL);
} else {
  // Single check mode (for Claude to call)
  checkProjects();
}
