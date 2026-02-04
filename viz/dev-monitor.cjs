const Database = require('better-sqlite3');

const projects = [
  { name: 'xpollination-mcp-server', path: '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db' },
  { name: 'HomePage', path: '/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db' }
];

const timestamp = new Date().toLocaleTimeString();
console.log(`[${timestamp}] MULTI-PROJECT DEV MONITORING ACTIVE`);
console.log(`Projects: ${projects.map(p => p.name).join(', ')}`);
console.log('---');

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
      console.log(`[${project.name}] ${tasks.length} DEV item(s):`);
      tasks.forEach(t => {
        console.log(`  - ${t.slug} (${t.type}): ${t.title || '(no title)'}`);
        devTasks.push({project: project.name, slug: t.slug, type: t.type, title: t.title});
      });
    } else {
      console.log(`[${project.name}] No DEV tasks`);
    }

    db.close();
  } catch (err) {
    console.log(`[${project.name}] Error: ${err.message}`);
  }
});

console.log('---');
console.log(`Total DEV tasks: ${devTasks.length}`);
if (devTasks.length === 0) console.log('Waiting for tasks... (poll every 30s)');
