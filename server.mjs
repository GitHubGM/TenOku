import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});return res.end()}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);return res.end('Bad request')}
 const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=resolve(root,relative);
 if(!file.startsWith(root.endsWith(sep)?root:root+sep)||!(/^(index\.html|styles\.css|src\/[\w-]+\.js|assets\/[\w.-]+\.svg)$/.test(relative))){res.writeHead(404);return res.end('Not found')}
 try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404);res.end('Not found')}
});server.listen(port,host,()=>console.log(`TEÑ BILIM: http://${host}:${port}`));
