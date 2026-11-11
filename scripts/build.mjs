import {mkdir,copyFile,cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await mkdir(dist,{recursive:true});
for(const name of ['index.html','styles.css'])await copyFile(new URL(name,root),new URL(name,dist));
for(const name of ['src','assets'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
console.log('Static site built in dist/');
