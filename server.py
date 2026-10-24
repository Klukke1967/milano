
import http.server, socketserver, os

PORT = 5085
os.chdir('/Users/agenten/milano-app')
Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    '.js': 'application/javascript',
})
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
