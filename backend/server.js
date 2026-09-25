const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
require('dotenv').config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to at least 32 random characters');
const dir = process.env.DATA_DIR || path.join(__dirname, 'storage');
fs.mkdirSync(dir, {recursive:true});
const file = path.join(dir, 'database.json');
let db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : {hospitals:require('./seed'),users:[],requisitions:[],doctorPhotos:{}};
// Copy-on-write: a failed disk write never reports success or changes live state.
function commit(change) {
  const next = structuredClone(db); change(next);
  fs.writeFileSync(file+'.tmp', JSON.stringify(next), {mode:0o600});
  fs.renameSync(file+'.tmp',file); db=next;
}
if(process.env.STAFF_EMAIL && process.env.STAFF_PASSWORD) {
  if(process.env.STAFF_PASSWORD.length<12) throw new Error('STAFF_PASSWORD must have at least 12 characters');
  const email=process.env.STAFF_EMAIL.toLowerCase();
  const hospitalIds=(process.env.STAFF_HOSPITAL_IDS||'kolaghat-rural').split(',').map(s=>s.trim());
  commit(d=>{const photo=d.users.find(u=>u.id==='staff-bootstrap')?.photo||'';d.users=d.users.filter(u=>u.email!==email);d.users.push({id:'staff-bootstrap',email,name:'Hospital Staff',role:'staff',hospitalIds,password:bcrypt.hashSync(process.env.STAFF_PASSWORD,12),photo});});
}
const app=express();
app.disable('x-powered-by'); app.set('trust proxy',1);
const origins=(process.env.FRONTEND_ORIGIN||'http://localhost:8000').split(',').map(s=>s.trim());
app.use(cors({origin(origin,cb){cb(null,!origin||origins.includes(origin));}}));
app.use(express.json({limit:'800kb'}));
app.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next();});
const hits=new Map();
setInterval(()=>hits.clear(),15*60*1000).unref();
function limit(req,res,next){const key=req.ip;const n=(hits.get(key)||0)+1;hits.set(key,n);if(n>60)return res.status(429).json({message:'Too many attempts. Try again in 15 minutes.'});next();}
function auth(req,res,next){try{const payload=jwt.verify((req.headers.authorization||'').replace(/^Bearer /,''),process.env.JWT_SECRET);req.user=db.users.find(u=>u.id===payload.id);if(!req.user)throw Error();next();}catch{return res.status(401).json({message:'Please sign in again.'});}}
function staff(req,res,next){if(req.user.role!=='staff')return res.status(403).json({message:'Staff access required'});next();}
function allowed(req,id){return req.user.hospitalIds?.includes(id);}
function publicUser(u){return {id:u.id,email:u.email,name:u.name,role:u.role,photo:u.photo||'',hospitalIds:u.hospitalIds||[]};}
function session(res,u){res.json({success:true,user:publicUser(u),token:jwt.sign({id:u.id},process.env.JWT_SECRET,{expiresIn:'8h'})});}
const text=(v,max=150)=>typeof v==='string' && v.trim().length>0 && v.length<=max;
const integer=v=>Number.isInteger(v)&&v>=0&&v<=10000;
function photoValid(v){return v==='' || (typeof v==='string'&&v.length<=700000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v));}
app.get('/api/health',(req,res)=>res.json({status:'ONLINE',mode:'prototype',storage:process.env.STORAGE_MODE||'local',message:'Sample facility data; no emergency dispatch integration'}));
app.post('/api/auth/register',limit,(req,res)=>{
 const {email,password}=req.body;
 if(!text(email,254)||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||Buffer.byteLength(password)>72)return res.status(400).json({message:'Use a valid email and a password of at least 12 characters (max 72 bytes).'});
 if(db.users.some(u=>u.email===email.toLowerCase()))return res.status(409).json({message:'Account exists. Sign in.'});
 const u={id:randomUUID(),email:email.toLowerCase(),name:email.split('@')[0],role:'citizen',password:bcrypt.hashSync(password,12),photo:''};commit(d=>d.users.push(u));session(res,u);
});
app.post('/api/auth/login',limit,(req,res)=>{
 const u=db.users.find(u=>u.email===String(req.body.email).toLowerCase());
 if(!u||typeof req.body.password!=='string'||!bcrypt.compareSync(req.body.password,u.password))return res.status(401).json({message:'Incorrect email or password'});
 session(res,u);
});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:publicUser(req.user)}));
app.put('/api/auth/photo',auth,(req,res)=>{if(!photoValid(req.body.photo))return res.status(400).json({message:'Invalid photo (max 700 KB)'});commit(d=>d.users.find(u=>u.id===req.user.id).photo=req.body.photo);res.json({success:true});});
app.get('/api/hospitals',(req,res)=>res.json({success:true,data:db.hospitals,doctorPhotos:db.doctorPhotos,sampleData:true}));
app.get('/api/hospitals/:id',(req,res)=>{const h=db.hospitals.find(h=>h.id===req.params.id);res.status(h?200:404).json(h?{data:h}:{message:'Hospital not found'});});
app.put('/api/hospitals/:id/telemetry',auth,staff,(req,res)=>{
 if(!allowed(req,req.params.id))return res.status(403).json({message:'This hospital is not assigned to your staff account'});
 const h=db.hospitals.find(h=>h.id===req.params.id);if(!h)return res.status(404).json({message:'Hospital not found'});
 const {icuBeds,ventilators,generalBeds,bloodStock}=req.body;
 if(![icuBeds,ventilators,generalBeds].every(integer)||!bloodStock||!Object.keys(bloodStock).every(k=>Object.hasOwn(h.bloodStock,k)&&integer(bloodStock[k])))return res.status(400).json({message:'Inventory must contain valid non-negative whole numbers'});
 commit(d=>{const h=d.hospitals.find(h=>h.id===req.params.id);Object.assign(h,{icuBeds,ventilators,generalBeds,updatedAt:new Date().toISOString()});Object.assign(h.bloodStock,bloodStock);});res.json({success:true,data:db.hospitals.find(h=>h.id===req.params.id)});
});
app.put('/api/doctors/photo',auth,staff,(req,res)=>{
 const {name,photo}=req.body;const h=db.hospitals.find(h=>h.doctors.some(d=>d.name===name));
 if(!h||!allowed(req,h.id))return res.status(403).json({message:'Doctor is not assigned to your hospital'});
 if(!photoValid(photo))return res.status(400).json({message:'Invalid photo'});
 commit(d=>{d.doctorPhotos[name]=photo;});res.json({success:true});
});
app.get('/api/doctors',(req,res)=>res.json({data:db.hospitals.flatMap(h=>h.doctors.map(d=>({...d,hospitalId:h.id,hospitalName:h.name,photo:db.doctorPhotos[d.name]||''})))}));
app.get('/api/blood-matrix',(req,res)=>res.json({data:db.hospitals.map(h=>({hospitalId:h.id,bloodStock:h.bloodStock})),sampleData:true}));
app.get('/api/organs',(req,res)=>res.json({data:db.hospitals.flatMap(h=>h.organs.map(o=>({...o,hospitalId:h.id}))),sampleData:true}));
app.post('/api/requisitions',auth,limit,(req,res)=>{
 const {patientName,item,units,receivingHospital,contactPhone}=req.body;
 if(![patientName,item,receivingHospital,contactPhone].every(v=>text(v))||!Number.isInteger(units)||units<1||units>10)return res.status(400).json({message:'Complete all fields; units must be 1–10.'});
 const r={id:randomUUID(),userId:req.user.id,patientName,item,units,receivingHospital,contactPhone,status:'RECORDED_NOT_DISPATCHED',createdAt:new Date().toISOString()};commit(d=>d.requisitions.unshift(r));res.status(201).json({success:true,data:r});
});
app.get('/api/requisitions',auth,(req,res)=>res.json({data:db.requisitions.filter(r=>r.userId===req.user.id)}));
app.use((req,res)=>res.status(404).json({message:'Route not found'}));
app.use((err,req,res,next)=>{console.error(err.message);res.status(err.status||500).json({message:err.status===413?'Photo is too large':'Request failed; please retry.'});});
if(require.main===module)app.listen(process.env.PORT||5000,'0.0.0.0',()=>console.log('PulsePoint API listening'));
module.exports=app;
