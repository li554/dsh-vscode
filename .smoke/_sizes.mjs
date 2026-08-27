import fs from "node:fs";
import path from "node:path";
function size(p){let s=0,c=0;for(const e of fs.readdirSync(p,{withFileTypes:true})){const fp=path.join(p,e.name);if(e.isDirectory()){const r=size(fp);s+=r[0];c+=r[1];}else{s+=fs.statSync(fp).size;c++;}}return [s,c];}
const d="D:/PycharmProjects/Work/dsh-vscode/plugins/node_modules";
const rows=[];
for(const e of fs.readdirSync(d)){const fp=path.join(d,e);if(!fs.statSync(fp).isDirectory())continue;
  if(e.startsWith("@")){for(const s of fs.readdirSync(fp)){const p2=path.join(fp,s);if(!fs.statSync(p2).isDirectory())continue;const r=size(p2);rows.push([e+"/"+s,r[0],r[1]]);}}
  else{const r=size(fp);rows.push([e,r[0],r[1]]);}
}
rows.sort((a,b)=>b[1]-a[1]);
let cum=0,total=rows.reduce((a,r)=>a+r[1],0);
console.log("TOTAL flat="+Math.round(total/1048576)+"MB");
for(const [n,s,c] of rows){cum+=s;if(s>500000||n.includes("jpeg")||n.includes("lightning")||n.includes("ws")||n.includes("schemas")||n.startsWith("@deepseek-ai/")||n.includes("yuheng"))console.log(n.padEnd(36)+Math.round(s/1048576)+"MB  "+c);}