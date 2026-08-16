import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
const root=process.cwd(), dist=join(root,"dist");
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
const keep=["index.html","favicon.svg","assets","lucia","promos","beneficios","tienda","support","recibos","alucia-enhancements.js","alucia-enhancements.css","alucia-trigger.js"];
for (const name of keep) { try { await cp(join(root,name),join(dist,name),{recursive:true}); } catch {} }
console.log("dist/ creado con interfaz final exacta + ALUCIA externa.");
