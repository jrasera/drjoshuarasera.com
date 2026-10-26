'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),errors=[];
const htmlFiles=fs.readdirSync(root).filter(n=>n.endsWith('.html')).map(n=>path.join(root,n));
htmlFiles.push(path.join(root,'applets/bne-3d/index.html'));
const cssFiles=fs.readdirSync(root).filter(n=>n.endsWith('.css')).map(n=>path.join(root,n));
function localReference(from,ref){
 if(!ref||ref.startsWith('#')||/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref))return;
 let relative;try{relative=decodeURIComponent(ref.split(/[?#]/)[0]);}catch{errors.push(`Invalid URL in ${from}: ${ref}`);return;}
 const target=relative.startsWith('/')?path.join(root,relative):path.resolve(path.dirname(from),relative);
 if(!fs.existsSync(target))errors.push(`Missing reference in ${path.relative(root,from)}: ${ref}`);
}
for(const file of htmlFiles){
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/\b(?:src|href)=["']([^"']+)["']/g))localReference(file,match[1]);
 for(const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))try{new vm.Script(match[1],{filename:file});}catch(error){errors.push(error.message);}
 // Inline script strings can contain generated markup; check only document markup.
 const markup=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const markupIds=[...markup.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
 if(new Set(markupIds).size!==markupIds.length)errors.push(`Duplicate element ID in ${file}`);
}
for(const file of cssFiles)for(const match of fs.readFileSync(file,'utf8').matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))localReference(file,match[1]);
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.js')))try{new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}catch(error){errors.push(error.message);}
const page=fs.readFileSync(path.join(root,'size-classification.html'),'utf8');
if(!page.includes('applets/bne-3d/?embedded=1')||/src="bne\.js"/.test(page))errors.push('Size-classification page must use the Unity embed.');
const player=fs.readFileSync(path.join(root,'applets/bne-3d/index.html'),'utf8');
if(player.includes('{{{')||/value="(?:paper7|paper8|full7|full8|quick)"/.test(player))errors.push('Production player has template tokens or retired presets.');
for(const m of player.matchAll(/Build\/[a-z\d.-]+(?:unityweb|js)/gi))localReference(path.join(root,'applets/bne-3d/index.html'),m[0]);
for(const file of htmlFiles.filter(f=>path.dirname(f)===root)){
 const source=fs.readFileSync(file,'utf8');
 if(!source.includes('assets/identity/material-icon.svg')||!source.includes('assets/identity/wordmark-light.svg')||!source.includes('assets/identity/monogram-light.svg'))errors.push(`Missing approved identity in ${file}`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS: ${htmlFiles.length} HTML pages; local links, styles, JavaScript syntax, Unity build references and approved identity.`);
