const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT = __dirname;
const LEADS_FILE = path.join(ROOT, 'leads.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function saveLeadToDisk(lead) {
    try {
        let leads = [];
        if (fs.existsSync(LEADS_FILE)) {
            const raw = fs.readFileSync(LEADS_FILE, 'utf8');
            try {
                leads = JSON.parse(raw);
                if (!Array.isArray(leads)) leads = [];
            } catch (e) {
                leads = [];
            }
        }
        lead.serverReceivedAt = new Date().toISOString();
        leads.unshift(lead); // newest first
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
        console.log(`[Lead Recorded] ${lead.type || lead.leadCategory || 'General Lead'} from ${lead.email || 'unknown'} (Total: ${leads.length})`);
        return true;
    } catch (err) {
        console.error('[Lead Save Error]', err);
        return false;
    }
}

const server = http.createServer((req, res) => {
    // Enable CORS for local testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const cleanUrl = req.url.split('?')[0];

    // API endpoint to log leads locally
    if (req.method === 'POST' && cleanUrl === '/api/submit-lead') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1e6) req.connection.destroy(); // 1MB limit
        });
        req.on('end', () => {
            try {
                const leadData = JSON.parse(body || '{}');
                const success = saveLeadToDisk(leadData);
                res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success, message: success ? 'Lead saved locally to leads.json' : 'Failed to write lead' }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // API endpoint to view saved leads
    if (req.method === 'GET' && cleanUrl === '/api/leads') {
        let leads = [];
        if (fs.existsSync(LEADS_FILE)) {
            try {
                leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            } catch (e) {
                leads = [];
            }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total: leads.length, leads }, null, 2));
        return;
    }

    // Static file serving
    let reqUrl = decodeURI(cleanUrl);
    let filePath = path.join(ROOT, reqUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
        filePath = filePath + '.html';
    } else if (!fs.existsSync(filePath) && fs.existsSync(path.join(filePath, 'index.html'))) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
        filePath = path.join(ROOT, '404.html');
        res.statusCode = 404;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end(`Server Error: ${err.code}`);
        } else {
            res.writeHead(res.statusCode || 200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`LabelOrigin local server running at http://localhost:${PORT}/`);
    console.log(`Leads file: ${LEADS_FILE}`);
});
