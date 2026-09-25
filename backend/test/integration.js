const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
process.env.JWT_SECRET='integration-test-secret-with-at-least-32-characters';
process.env.STAFF_EMAIL='staff@example.com';process.env.STAFF_PASSWORD='Test-only-password-123';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'pulsepoint-test-'));
process.env.FRONTEND_ORIGIN='https://dynamicop-art.github.io';
const app=require('../server');
test('authentication, hospital authorization, durable writes, photos, requests and CORS',async()=>{
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 async function req(route,method='GET',body,token){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,...await r.json()};}
 try {
 assert.equal((await req('/health')).status,'ONLINE');
 assert.equal((await req('/hospitals')).data.length,5);
 assert.equal((await req('/auth/login','POST',{email:process.env.STAFF_EMAIL,password:'wrong'})).status,401);
 const user=await req('/auth/register','POST',{email:'patient@example.com',password:'Patient-password-123',role:'staff'});
 assert.equal(user.user.role,'citizen');
 const staff=await req('/auth/login','POST',{email:process.env.STAFF_EMAIL,password:process.env.STAFF_PASSWORD});
 const stock={icuBeds:9,ventilators:3,generalBeds:40,bloodStock:{'O-':8}};
 assert.equal((await req('/hospitals/kolaghat-rural/telemetry','PUT',stock)).status,401);
 assert.equal((await req('/hospitals/kolaghat-rural/telemetry','PUT',stock,user.token)).status,403);
 assert.equal((await req('/hospitals/ktpp-medical/telemetry','PUT',stock,staff.token)).status,403);
 assert.equal((await req('/hospitals/kolaghat-rural/telemetry','PUT',{...stock,icuBeds:-1},staff.token)).status,400);
 assert.equal((await req('/hospitals/kolaghat-rural/telemetry','PUT',stock,staff.token)).status,200);
 assert.equal((await req('/hospitals/kolaghat-rural')).data.icuBeds,9);
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1kAAAAASUVORK5CYII=';
 assert.equal((await req('/auth/photo','PUT',{photo},user.token)).status,200);
 assert.equal((await req('/auth/me','GET',undefined,user.token)).user.photo,photo);
 assert.equal((await req('/doctors/photo','PUT',{name:'Dr. Debabrata Sen',photo},user.token)).status,403);
 assert.equal((await req('/doctors/photo','PUT',{name:'Dr. Debabrata Sen',photo},staff.token)).status,200);
 const request={patientName:'Test Patient',item:'O-',units:2,receivingHospital:'Demo Hospital',contactPhone:'0000000000'};
 assert.equal((await req('/requisitions','POST',request)).status,401);
 assert.equal((await req('/requisitions','POST',request,user.token)).data.status,'RECORDED_NOT_DISPATCHED');
 assert.equal((await req('/requisitions','GET',undefined,staff.token)).data.length,0);
 const disk=JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR,'database.json')));
 assert.equal(disk.requisitions.length,1);assert.equal(disk.hospitals[0].icuBeds,9);
 delete require.cache[require.resolve('../server')];
 const restarted=require('../server').listen(0);await new Promise(r=>restarted.once('listening',r));
 try {
 const result=await fetch(`http://127.0.0.1:${restarted.address().port}/api/auth/me`,{headers:{Authorization:'Bearer '+user.token}});
 assert.equal((await result.json()).user.photo,photo);
 const h=await fetch(`http://127.0.0.1:${restarted.address().port}/api/hospitals/kolaghat-rural`);
 assert.equal((await h.json()).data.icuBeds,9);
 } finally {restarted.close();}
 for(const origin of ['https://dynamicop-art.github.io','https://untrusted.example']){
 const r=await fetch(base+'/health',{headers:{Origin:origin}});
 assert.equal(r.headers.get('access-control-allow-origin'),origin.includes('untrusted')?null:origin);
 }
 }finally{server.close();fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true});}
});
