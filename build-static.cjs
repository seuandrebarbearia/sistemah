const fs = require('node:fs');
fs.mkdirSync('dist', { recursive: true });
for (const file of ['index.html','login.html','admin.html','script.js','admin.js','login.js','safe.js','style.css']) fs.copyFileSync(file, 'dist/' + file);
