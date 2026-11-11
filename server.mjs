import http from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {createApp} from './backend/app.mjs';
export {createApp} from './backend/app.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const envPath=fileURLToPath(new URL('.env',import.meta.url));if(existsSync(envPath))process.loadEnvFile(envPath);
 const handler=createApp({dbPath:process.env.DATABASE_PATH||resolve(process.env.DATA_DIR||fileURLToPath(new URL('data/',import.meta.url)),'app.sqlite')});
 const server=http.createServer(handler);server.requestTimeout=40000;server.headersTimeout=15000;
 const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
 server.listen(port,host,()=>console.log(`TEÑ BILIM: http://${host}:${port}`));
 const stop=()=>server.close(()=>{handler.close();process.exit(0)});process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
