// Simple static file server for the frontend
const PORT = 8080;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    
    // Default to index.html
    if (path === '/') path = '/index.html';
    
    // Remove leading slash for file path
    const filePath = path.slice(1);
    
    try {
      const file = Bun.file(filePath);
      
      // Set content type based on extension
      const ext = filePath.split('.').pop();
      const contentTypes = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json'
      };
      
      return new Response(file, {
        headers: {
          'Content-Type': contentTypes[ext] || 'text/plain',
          'Cache-Control': 'no-cache'
        }
      });
    } catch (error) {
      return new Response('404 Not Found', { status: 404 });
    }
  }
});

console.log(`
🌐 XLN Frontend running at http://localhost:${PORT}

Open this URL in your browser to see the demo.

Make sure the backend is running on port 3000!
`);