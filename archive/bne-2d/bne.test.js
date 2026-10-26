const test=require('node:test'),assert=require('node:assert/strict');
const {BNEBed,BOX}=require('./bne-engine.js');
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,a+' vs '+b);
const settle=b=>{while(!b.prepared)b.prepareStep();return b;};
function simulate(b,t,dt){while(b.time<t-1e-12)b.step(Math.min(dt??b.nextDt(),t-b.time));return b;}
function isolated(){
 const b=new BNEBed({smallCount:80});b.grains=b.grains.slice(1,3);
 b.options.gravity=0;b.options.amplitude=0;b.options.friction=0;b.neighbors=null;
 for(let i=0;i<2;i++)Object.assign(b.grains[i],{id:i,x:.035+i*.0043,y:.06,r:.002,mass:.000125,inertia:.5*.000125*.002**2,vx:i?-.1:.1,vy:0,omega:0});
 return b;
}
test('both sample modes generate nonoverlapping grains with area-based mass and rotational inertia',()=>{
 for(const mode of ['intruder','mixture']){
  const b=new BNEBed({mode,smallCount:80,largeCount:8});
  assert.equal(b.grains.filter(p=>p.large).length,mode==='intruder'?1:8);
  assert.equal(b.grains.filter(p=>!p.large).length,80);
  for(const p of b.grains){near(p.mass,BOX.density*Math.PI*p.r*p.r*BOX.thickness);near(p.inertia,.5*p.mass*p.r*p.r);}
  for(let i=0;i<b.grains.length;i++)for(let j=0;j<i;j++){const a=b.grains[i],c=b.grains[j];assert.ok(Math.hypot(a.x-c.x,a.y-c.y)>a.r+c.r);}
 }
});
test('container acceleration is the second derivative of its smoothly ramped displacement',()=>{
 const b=new BNEBed({drive:'ramped'}),h=1e-6;
 for(const t of [.001,.1,.249,.3,.7]){
  const fd=(b.motion(t+h).y-2*b.motion(t).y+b.motion(t-h).y)/h**2;
  near(fd,b.motion(t).a,5e-5);
 }
 near(b.motion(0).v,0);near(b.motion(0).a,0);
});
test('head-on contacts conserve momentum, dissipate energy and converge on timestep refinement',()=>{
 const outputs=[];
 for(const factor of [1,.5,.25]){
  const b=isolated(),initial=b.stats().kinetic;simulate(b,.025,b.dt*factor);
  near(b.grains.reduce((s,p)=>s+p.mass*p.vx,0),0);
  assert.ok(b.stats().kinetic<initial);
  const effective=-b.grains[0].vx/.1;assert.ok(Math.abs(effective-.6)<.08);
  outputs.push(effective);
 }
 assert.ok(Math.abs(outputs[1]-outputs[2])<.01);
});
test('friction produces spin and respects the Coulomb force bound',()=>{
 const b=isolated(),a=b.grains[0],c=b.grains[1];b.options.friction=.4;
 a.vy=.2;a.fx=a.fy=a.torque=c.fx=c.fy=c.torque=0;b.serial=1;
 b.contact(a,c,-1,0,.00001,1,b.dt);
 assert.ok(a.torque!==0&&c.torque!==0);
 assert.ok(Math.abs(a.fy)<=.4*Math.abs(a.fx)+1e-12);
 near(a.fx+c.fx,0);near(a.fy+c.fy,0);
});
test('gravity accelerates a freely flying large grain exactly as a small grain',()=>{
 const b=new BNEBed({smallCount:80,frequency:0}),large=b.grains[0],small=b.grains[1];
 b.grains=[large,small];Object.assign(large,{id:0,x:.025,y:.07});Object.assign(small,{id:1,x:.055,y:.07});
 const dt=b.dt;b.step(dt,false);
 near(large.vy,-9.81*dt);near(small.vy,-9.81*dt);
 near(large.vx,0);near(small.vx,0);
});
test('a settled bed remains stationary with zero frequency or zero amplitude',()=>{
 for(const options of [{frequency:0},{amplitude:0}]){
  const b=settle(new BNEBed({...options,smallCount:80})),before=b.stats();
  simulate(b,.4);assert.ok(Math.abs(b.stats().separation-before.separation)<1e-6);
  assert.ok(b.stats().kinetic<1e-9);
 }
});
test('same seed reproduces the bed and changed seed produces a different arrangement',()=>{
 const a=new BNEBed({smallCount:80}),b=new BNEBed({smallCount:80}),c=new BNEBed({smallCount:80,seed:12});
 for(let i=0;i<100;i++){a.step();b.step();}
 assert.deepEqual(a.grains,b.grains);assert.notDeepEqual(a.grains,c.grains);
});
test('representative and extreme settings remain finite without excessive contact overlap',()=>{
 for(const options of [{},{mode:'mixture',ratio:2,largeCount:8},{mode:'mixture',ratio:1,densityRatio:3,largeCount:8},{frequency:60,amplitude:3}]){
  const b=settle(new BNEBed({...options,smallCount:80}));simulate(b,.6);
  assert.ok(b.grains.every(p=>Number.isFinite(p.x+p.y+p.vx+p.vy+p.omega)));
  assert.ok(b.peakPenetration<(b.options.solver==='rigid'?.5:.16),'overlap/r '+b.peakPenetration);
  assert.ok(b.grains.every(p=>p.x>-p.r&&p.x<BOX.width+p.r&&p.y>-p.r&&p.y<BOX.height+p.r));
 }
});
test('the background worker prepares, runs and completes a physical experiment',async()=>{
 const {Worker}=require('node:worker_threads'),fs=require('node:fs');
 const engine=require.resolve('./bne-engine.js'),source=fs.readFileSync(require.resolve('./bne-worker.js'),'utf8');
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.postMessage=m=>parentPort.postMessage(m);global.importScripts=()=>{global.BNE=require(${JSON.stringify(engine)})};${source};parentPort.on('message',data=>onmessage({data}));`,{eval:true});
 try{
  const done=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Worker failed to finish')),30000);
   worker.on('error',e=>{clearTimeout(timer);reject(e);});
   worker.on('message',data=>{
    if(data.type==='error'){clearTimeout(timer);reject(new Error(data.message));}
    if(data.type==='ready'){assert.equal(data.time,0);assert.ok(data.initial);worker.postMessage({type:'run',rate:1});}
    if(data.type==='done'){clearTimeout(timer);resolve(data);}
   });
   worker.postMessage({type:'init',options:{smallCount:80,duration:1}});
  });
  near(done.time,1,1e-10);assert.equal(done.grains.length,81);assert.ok(done.history.length>=9);
  assert.ok(Number.isFinite(done.stats.separation));assert.ok(done.overlap>0&&done.overlap<.16);
 }finally{await worker.terminate();}
});

test('cell dimensions and extended particle ratios produce valid nonoverlapping starting beds',()=>{
 for(const options of [{ratio:10,cellWidth:120,cellHeight:200,smallCount:80},{mode:'mixture',ratio:6,cellWidth:160,cellHeight:240,largeCount:4,smallCount:120},{mode:'mixture',ratio:4.5,cellWidth:80,cellHeight:160,smallCount:80}]){
  const b=new BNEBed(options);
  near(b.box.width,options.cellWidth/1000);near(b.box.height,options.cellHeight/1000);
  for(let i=0;i<b.grains.length;i++)for(let j=0;j<i;j++){const a=b.grains[i],c=b.grains[j];assert.ok(Math.hypot(a.x-c.x,a.y-c.y)>=a.r+c.r);}
  assert.ok(b.grains.every(p=>p.x-p.r>0&&p.x+p.r<b.box.width&&p.y-p.r>0&&p.y+p.r<b.box.height));
 }
 assert.throws(()=>new BNEBed({ratio:10,cellWidth:40}),/do not fit/);
});
test('cell width and height set the physical wall contact locations',()=>{
 const b=isolated();b.box.width=.12;b.box.height=.2;
 b.grains=[b.grains[0]];b.grains[0].x=.119;b.grains[0].y=.199;b.grains[0].vx=0;
 b.step();assert.ok(b.grains[0].fx<0&&b.grains[0].fy<0);
});
test('wall friction is independent of grain friction',()=>{
 const b=isolated(),a=b.grains[0];a.vy=.2;b.options.friction=.8;b.options.wallFriction=0;b.serial=1;
 a.fx=a.fy=a.torque=0;b.contact(a,null,1,0,.00001,0,b.dt);
 near(a.fy,0);near(a.torque,0);
 b.options.wallFriction=.5;a.fx=a.fy=a.torque=0;b.serial++;
 b.contact(a,null,1,0,.00001,0,b.dt);assert.ok(a.fy<0&&a.torque!==0);
});
test('150 Hz shaking uses a resolved timestep and remains finite',()=>{
 const b=settle(new BNEBed({frequency:150,amplitude:.35,smallCount:40}));
 assert.ok(b.dt<=1/150/160);simulate(b,.15);
 assert.ok(b.grains.every(p=>Number.isFinite(p.x+p.y+p.omega)));
 assert.ok(b.peakPenetration<.16);
});
test('a stronger shaking case produces relative intruder rise through contacts',()=>{
 const b=settle(new BNEBed({frequency:50,amplitude:1.5,smallCount:80}));
 const before=b.stats().separation;simulate(b,3);
 assert.ok(b.stats().separation-before>.002);
 assert.ok(b.peakPenetration<.1);
});

test('stochastic mixtures contain many independently sized particles dispersed through the bed',()=>{
 const b=new BNEBed({mode:'mixture'}),large=b.grains.filter(p=>p.large),small=b.grains.filter(p=>!p.large);
 assert.equal(b.grains.length,1600);assert.equal(large.length,600);assert.equal(small.length,1000);
 for(const [ps,min,max]of [[small,.8,1],[large,1.2,1.4]]){
  assert.ok(ps.every(p=>p.r*2000>=min&&p.r*2000<=max));
  assert.ok(new Set(ps.map(p=>p.r)).size>100);
 }
 const mean=ps=>ps.reduce((sum,p)=>sum+p.y,0)/ps.length;
 const height=Math.max(...b.grains.map(p=>p.y));
 assert.ok(Math.abs(mean(large)-mean(small))<height*.08);
 assert.ok(large.some(p=>p.y<height*.25)&&large.some(p=>p.y>height*.75));
 assert.ok(small.some(p=>p.y<height*.25)&&small.some(p=>p.y>height*.75));
});
test('layered generator places every large particle below every small particle',()=>{
 for(const mode of ['intruder','mixture']){
  const b=new BNEBed({mode,initialization:'layered'});
  const upperLarge=Math.max(...b.grains.filter(p=>p.large).map(p=>p.y+p.r));
  const lowerSmall=Math.min(...b.grains.filter(p=>!p.large).map(p=>p.y-p.r));
  assert.ok(upperLarge<lowerSmall);
 }
});
test('5,000 particles use local neighbor/contact storage rather than a quadratic matrix',()=>{
 const b=new BNEBed({mode:'mixture',smallCount:3000,largeCount:2000,cellWidth:160,cellHeight:240,frequency:15,amplitude:.5});
 assert.equal(b.grains.length,5000);
 const before=process.memoryUsage().arrayBuffers;
 for(let i=0;i<20;i++)b.step();
 assert.ok(b.neighbors.length<b.grains.length*40);
 assert.ok(b.contacts.size<b.grains.length*10);
 assert.ok(process.memoryUsage().arrayBuffers-before<5e6);
 assert.equal(b.historyX,undefined);
 for(const [a,c]of b.neighbors)assert.ok(Number.isFinite(a.x+c.y));
 assert.throws(()=>new BNEBed({mode:'mixture',smallCount:4000,largeCount:2000}),/5,000/);
});
test('stochastic and layered packing are reproducible and contain no initial overlaps',()=>{
 for(const initialization of ['random','layered']){
  const a=new BNEBed({mode:'mixture',smallCount:120,largeCount:80,initialization}),b=new BNEBed({mode:'mixture',smallCount:120,largeCount:80,initialization});
  assert.deepEqual(a.grains,b.grains);
  for(let i=0;i<a.grains.length;i++)for(let j=0;j<i;j++){const p=a.grains[i],q=a.grains[j];assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>p.r+q.r);}
 }
});
test('spatial neighbor search includes every contacting pair',()=>{
 const b=new BNEBed({mode:'mixture',smallCount:120,largeCount:80,frequency:0});
 // Introduce several controlled contacts without depending on the random packing.
 for(let i=0;i<10;i+=2){b.grains[i+1].x=b.grains[i].x+b.grains[i].r;b.grains[i+1].y=b.grains[i].y;}
 b.step();
 const listed=new Set(b.neighbors.map(([a,c])=>Math.max(a.id,c.id)+':'+Math.min(a.id,c.id)));
 for(let i=0;i<b.grains.length;i++)for(let j=0;j<i;j++){
  const a=b.grains[i],c=b.grains[j];
  if(Math.hypot(a.neighborX-c.neighborX,a.neighborY-c.neighborY)<a.r+c.r)assert.ok(listed.has(i+':'+j));
 }
});

test('rigid contacts conserve pair momentum and reproduce restitution',()=>{
 const b=isolated();b.options.solver='rigid';b.dt=.00005;b.minR=.002;b.maxR=.002;b.skin=.0008;
 const initial=b.stats().kinetic;simulate(b,.025);
 near(b.grains.reduce((sum,p)=>sum+p.mass*p.vx,0),0);
 assert.ok(b.stats().kinetic<initial);
 near(-b.grains[0].vx/.1,.6,.005);
});
test('rigid contacts produce rotation with sliding friction and stay still without vibration',()=>{
 const b=new BNEBed({mode:'mixture',smallCount:80,largeCount:40,frequency:0,solver:'rigid'});settle(b);
 const initial=b.stats().separation;simulate(b,.1);
 assert.ok(Math.abs(b.stats().separation-initial)<.0001);
 assert.ok(b.stats().kinetic<1e-7);
});
test('a thousand-particle rigid bed prepares with finite motion and bounded memory',()=>{
 const b=settle(new BNEBed({mode:'mixture',smallCount:600,largeCount:400,frequency:25,amplitude:.5}));
 assert.ok(b.prepared);assert.ok(b.initial);simulate(b,.03);
 assert.ok(b.grains.every(p=>Number.isFinite(p.x+p.y+p.omega)));
 assert.ok(b.contacts.size<b.grains.length*30);
 let residual=0;
 for(const [a,c]of b.neighbors)residual=Math.max(residual,(a.r+c.r-Math.hypot(a.x-c.x,a.y-c.y))/Math.min(a.r,c.r));
 assert.ok(residual<.12,'residual overlap/r '+residual);
});

test('10 mm cells retain physical grain sizes and single-intruder counts',()=>{
 const b=new BNEBed({cellWidth:10,cellHeight:300,smallCount:40,ratio:2,largeCount:8});
 near(b.box.width,.01);assert.equal(b.options.largeCount,1);assert.equal(b.grains.filter(p=>p.large).length,1);
 assert.ok(b.grains.every(p=>p.x-p.r>0&&p.x+p.r<b.box.width));
 assert.throws(()=>new BNEBed({cellWidth:10,ratio:3}),/do not fit/);
});

test('full harmonic vial motion maintains the prescribed stroke and acceleration',()=>{
 const b=new BNEBed({frequency:15,amplitude:1.5}),A=.0015,w=2*Math.PI*15;
 near(b.motion(0).v,0);near(b.motion(0).a,-A*w*w);
 for(const cycle of [0,1,10,100]){near(b.motion((cycle+.5)/15).y,-2*A);near(b.motion(cycle/15).y,0);}
});
test('Hertz normal force follows the 3/2 power law and damping ratios are independent of restitution',()=>{
 const b=isolated(),a=b.grains[0],c=b.grains[1];b.options.solver='hertz';b.options.normalDamping=0;b.options.shearDamping=0;
 a.vx=c.vx=0;
 const force=(overlap,key)=>{a.fx=a.fy=a.torque=c.fx=c.fy=c.torque=0;b.serial++;b.contact(a,c,-1,0,overlap,key,b.dt);return -a.fx;};
 const first=force(1e-6,1);near(force(4e-6,2)/first,8);
 b.options.restitution=.1;near(force(1e-6,3),first);
 b.options.restitution=.95;near(force(1e-6,4),first);
 a.vx=.1;b.options.normalDamping=.2;assert.ok(force(1e-6,5)>first);
 assert.equal(b.options.shearDamping,0);
});
test('Hertz shear history does not gain elastic energy during normal unloading',()=>{
 const b=isolated(),a=b.grains[0],c=b.grains[1];b.options.solver='hertz';b.options.friction=1;
 a.vx=c.vx=0;a.vy=.0001;b.serial=1;b.contact(a,c,-1,0,4e-6,1,1e-4);
 const old=b.contacts.get(1),energy=(old.fx**2+old.fy**2)/(2*old.kt);
 a.vy=0;b.serial++;b.contact(a,c,-1,0,1e-6,1,1e-4);
 const next=b.contacts.get(1);assert.ok((next.fx**2+next.fy**2)/(2*next.kt)<=energy);
});
test('stopping a vial preserves particle lab-frame velocity and freezes its displacement',()=>{
 const b=new BNEBed({duration:1,frequency:15.25});b.time=1;
 const motion=b.motion(),before=b.grains.map(p=>p.vy+motion.v);b.stopShaking();
 b.grains.forEach((p,i)=>near(p.vy,before[i]));near(b.motion().v,0);near(b.motion().a,0);near(b.motion().y,motion.y);
 const time=b.time;b.restStep(1e-7);near(b.time,time);near(b.restTime,1e-7);
});

test('Hertz collisions conserve momentum and respond to direct dashpot damping',()=>{
 const energies=[];
 for(const normalDamping of [0,.2]){
  const b=isolated();b.options.solver='hertz';b.options.normalDamping=normalDamping;b.options.shearDamping=0;
  const initial=b.stats().kinetic;simulate(b,.025);
  near(b.grains.reduce((sum,p)=>sum+p.mass*p.vx,0),0);
  energies.push(b.stats().kinetic/initial);
 }
 assert.ok(Math.abs(energies[0]-1)<.01,'elastic energy ratio '+energies[0]);
 assert.ok(energies[1]<.8,'damped energy ratio '+energies[1]);
});
