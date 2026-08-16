import { spawn } from 'node:child_process';
const children=[];
function run(file,env={}){const p=spawn(process.execPath,[file],{stdio:'inherit',env:{...process.env,...env}});children.push(p);p.on('exit',code=>{if(code&&code!==0) console.error(`${file} terminó con código ${code}`)});}
run('lucia-backend-v2.mjs');
run('server.mjs',{PORT:'3000'});
process.on('SIGINT',()=>{for(const p of children)p.kill();process.exit(0)});
