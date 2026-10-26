/* 2D DEM in SI units, in the vertically translating container frame.
   Linear normal springs/dashpots, rotating disks, tangential contact history and
   Coulomb friction. No prescribed segregation, aerodynamic forces or cohesion. */
(function(root){
 'use strict';
 const DEFAULTS=Object.freeze({mode:'intruder',ratio:3,smallCount:160,largeCount:1,frequency:50,amplitude:1.5,duration:5,friction:.45,wallFriction:.45,cellWidth:80,cellHeight:120,restitution:.6,densityRatio:1,gravity:9.81,seed:87413,stiffness:6400,solver:'soft',initialization:'layered',smallMin:.8,smallMax:1,largeMin:1.2,largeMax:1.4,youngModulus:63e6,poisson:.16,normalDamping:0,shearDamping:0,drive:'harmonic',restDuration:.5,settleDuration:1});
 const MIXTURE_DEFAULTS=Object.freeze({smallCount:1000,largeCount:600,solver:'rigid',smallMin:.8,smallMax:1,largeMin:1.2,largeMax:1.4,initialization:'random'});
 const BOX=Object.freeze({width:.08,height:.12,smallDiameter:.004,thickness:.004,density:2500});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function damping(stiffness,mass,restitution){
  const l=Math.log(restitution),z=-l/Math.sqrt(Math.PI*Math.PI+l*l);
  return 2*z*Math.sqrt(stiffness*mass);
 }
 class BNEBed{
  constructor(input={}){
   this.options={...DEFAULTS,...(input.mode==='mixture'?MIXTURE_DEFAULTS:{}),...input};
   const o=this.options;
   for(const [key,lo,hi]of [['ratio',1,10],['smallCount',40,4500],['largeCount',1,2500],['frequency',0,150],['amplitude',0,3],['duration',1,60],['friction',0,1],['wallFriction',0,1],['cellWidth',9,240],['cellHeight',60,300],['restitution',.1,.95],['densityRatio',.5,3],['gravity',1.62,9.81],['stiffness',100,25600],['youngModulus',1e6,63e9],['poisson',0,.45],['normalDamping',0,1],['shearDamping',0,1],['restDuration',0,5],['settleDuration',0,5],['smallMin',.2,8],['smallMax',.2,8],['largeMin',.2,40],['largeMax',.2,40]]){
    if(!Number.isFinite(o[key])||o[key]<lo||o[key]>hi)throw new Error('Invalid '+key);
   }
   if(!['intruder','mixture'].includes(o.mode))throw new Error('Invalid bed mode');
   if(!['soft','rigid','hertz'].includes(o.solver))throw new Error('Invalid contact solver');
   if(!['harmonic','ramped'].includes(o.drive))throw new Error('Invalid vibration drive');
   if(!['random','layered'].includes(o.initialization))throw new Error('Invalid initial arrangement');
   if(o.smallMax<o.smallMin||o.largeMax<o.largeMin)throw new Error('Each size interval must have its minimum below its maximum.');
   if(o.smallCount+(o.mode==='intruder'?1:o.largeCount)>5000)throw new Error('Use at most 5,000 particles in total.');
   o.smallCount=Math.round(o.smallCount);o.largeCount=o.mode==='intruder'?1:Math.round(o.largeCount);
   // Resolve more energetic impacts with stiffer contacts, keeping a small elastic overlap.
   const gamma=o.amplitude/1000*(2*Math.PI*o.frequency)**2/o.gravity;
   o.stiffness*=Math.max(1,gamma/4);
   this.box={...BOX,width:o.cellWidth/1000,height:o.cellHeight/1000};
   this.grains=[];this.time=0;this.restTime=0;this.stoppedMotion=null;this.contactFrequency2=0;this.settleTime=0;this.prepared=false;this.quiet=0;this.initial=null;this.maxPenetration=0;this.peakPenetration=0;
   this.randomSeed=o.seed>>>0;
   this.createBed();
   this.dt=.1*Math.sqrt(Math.min(...this.grains.map(p=>p.mass))/o.stiffness);
   this.dt=Math.min(this.dt,1/(Math.max(o.frequency,1)*160));
   this.totalMass=this.grains.reduce((sum,p)=>sum+p.mass,0);
   this.contacts=new Map();this.serial=0;this.neighbors=null;
   const log=Math.log(o.restitution);this.dampingFactor=-2*log/Math.sqrt(Math.PI*Math.PI+log*log)*Math.sqrt(o.stiffness);
   this.minR=Math.min(...this.grains.map(p=>p.r));this.maxR=Math.max(...this.grains.map(p=>p.r));this.skin=.4*this.minR;
   this.effectiveYoung=o.youngModulus/(2*(1-o.poisson**2));
   const shear=o.youngModulus/(2*(1+o.poisson));this.effectiveShear=shear/(2*(2-o.poisson));
   if(o.solver==='hertz')this.dt=1/(Math.max(o.frequency,1)*200);
   if(o.solver==='rigid')this.dt=Math.min(1/(Math.max(o.frequency,1)*100),.12*Math.sqrt(this.minR/o.gravity));

  }
  random(){this.randomSeed=(Math.imul(1664525,this.randomSeed)+1013904223)>>>0;return (this.randomSeed+.5)/4294967296;}
  add(x,y,r,large){
   const mass=BOX.density*(large?this.options.densityRatio:1)*Math.PI*r*r*BOX.thickness;
   this.grains.push({id:this.grains.length,x,y,r,large,mass,inertia:.5*mass*r*r,vx:0,vy:0,omega:0,angle:0,fx:0,fy:0,torque:0});
  }
  createBed(){
   const o=this.options,width=this.box.width,height=this.box.height;
   const specs=[];
   for(let i=0;i<o.smallCount;i++)specs.push({r:o.mode==='mixture'?(o.smallMin+(o.smallMax-o.smallMin)*this.random())/2000:BOX.smallDiameter/2*(.94+.12*this.random()),large:false});
   for(let i=0;i<(o.mode==='intruder'?1:o.largeCount);i++)specs.push({r:o.mode==='mixture'?(o.largeMin+(o.largeMax-o.largeMin)*this.random())/2000:BOX.smallDiameter*o.ratio/2,large:true});
   const maxR=Math.max(...specs.map(p=>p.r)),minR=Math.min(...specs.map(p=>p.r)),area=specs.reduce((sum,p)=>sum+Math.PI*p.r*p.r,0);
   const fail=()=>{throw new Error('These grains do not fit. Increase cell width/height, or reduce size or count.');};
   if(maxR*2>=Math.min(width,height)||area>width*height*.43)fail();
   const shuffle=list=>{for(let i=list.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
   const cell=maxR*2,cols=Math.ceil(width/cell)+3,grid=new Map(),gap=minR*.03;
   const groups=o.initialization==='layered'?[shuffle(specs.filter(p=>p.large)),shuffle(specs.filter(p=>!p.large))]:[shuffle(specs)];
   let base=0;
   for(const group of groups){
    const groupArea=group.reduce((sum,p)=>sum+Math.PI*p.r*p.r,0),groupMax=Math.max(...group.map(p=>p.r));
    const depth=Math.max(2*groupMax+2*gap,groupArea/(width*.24));
    const top=base+depth;
    if(top>height)fail();
    for(const spec of group){
     let placed=false;
     for(let attempt=0;attempt<4000&&!placed;attempt++){
      const x=spec.r+gap+this.random()*(width-2*spec.r-2*gap);
      const y=base+spec.r+gap+this.random()*(depth-2*spec.r-2*gap);
      const gx=Math.floor(x/cell),gy=Math.floor(y/cell);let hit=false;
      for(let ix=gx-1;ix<=gx+1&&!hit;ix++)for(let iy=gy-1;iy<=gy+1&&!hit;iy++){
       const list=grid.get(ix+cols*iy);
       if(list)for(const p of list)if((p.x-x)**2+(p.y-y)**2<(p.r+spec.r+gap)**2){hit=true;break;}
      }
      if(hit)continue;
      this.add(x,y,spec.r,spec.large);
      const key=gx+cols*gy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(this.grains[this.grains.length-1]);placed=true;
     }
     if(!placed)fail();
    }
    base=Math.max(...this.grains.map(p=>p.y+p.r))+gap;
   }
  }
  motion(t=this.time){
   const A=this.options.amplitude/1000,w=2*Math.PI*this.options.frequency;
   if(this.stoppedMotion&&t>=this.options.duration)return {y:this.stoppedMotion.y,v:0,a:0};
   // Start at a turning point: zero initial velocity, full prescribed amplitude.
   if(this.options.drive==='harmonic')return {y:A*(Math.cos(w*t)-1),v:-A*w*Math.sin(w*t),a:-A*w*w*Math.cos(w*t)};
   // Smooth 0.25 s onset: no instantaneous wall-velocity jump.
   const T=.25,u=clamp(t/T,0,1),s=u*u*u*(10+u*(-15+6*u));
   const ds=t<T?30*u*u*(1-u)*(1-u)/T:0;
   const dds=t<T?60*u*(1-u)*(1-2*u)/(T*T):0;
   return {y:A*s*Math.sin(w*t),v:A*(ds*Math.sin(w*t)+s*w*Math.cos(w*t)),a:A*(dds*Math.sin(w*t)+2*ds*w*Math.cos(w*t)-s*w*w*Math.sin(w*t))};
  }
  contact(a,b,nx,ny,overlap,key,dt){
   if(overlap<=0)return;
   const o=this.options,meff=b?a.mass*b.mass/(a.mass+b.mass):a.mass;
   const hertz=o.solver==='hertz',radius=b?a.r*b.r/(a.r+b.r):a.r;
   const root=Math.sqrt(radius*overlap);
   const kn=hertz?2*this.effectiveYoung*root:o.stiffness,kt=hertz?8*this.effectiveShear*root:o.stiffness*2/7;
   const gamma=hertz?2*o.normalDamping*Math.sqrt(meff*kn):this.dampingFactor*Math.sqrt(meff);
   this.contactFrequency2=Math.max(this.contactFrequency2,(kn+3*kt)/meff);
   const dx=a.vx-(b?b.vx:0),dy=a.vy-(b?b.vy:0),vn=dx*nx+dy*ny;
   const fn=Math.max(0,(hertz?2/3*kn:o.stiffness)*overlap-gamma*vn);
   const tx=-ny,ty=nx,vt=dx*tx+dy*ty-a.omega*a.r-(b?b.omega*b.r:0);
   const record=this.contacts.get(key);
   if(hertz){
    // PFC-style Hertz shear history, unloading rescale and no-tension/slip-cut dashpots.
    const old=record&&record.stamp===this.serial-1;
    const previous=old?(record.fx*tx+record.fy*ty)*Math.min(1,kt/record.kt):0;
    const mu=b?o.friction:o.wallFriction,elasticNormal=2/3*kn*overlap,trial=previous-kt*vt*dt;
    const elasticShear=clamp(trial,-mu*elasticNormal,mu*elasticNormal);
    const sliding=trial!==elasticShear;
    const ft=elasticShear-(sliding?0:2*o.shearDamping*Math.sqrt(meff*kt)*vt);
    if(record){record.fx=elasticShear*tx;record.fy=elasticShear*ty;record.kt=kt;record.stamp=this.serial;}
    else this.contacts.set(key,{fx:elasticShear*tx,fy:elasticShear*ty,kt,stamp:this.serial});
    this.applyContact(a,b,nx,ny,fn,ft,overlap);return;
   }
   const old=record&&record.stamp===this.serial-1,gt=gamma*.5;
   let xi=(old?record.x*tx+record.y*ty:0)+vt*dt;
   const mu=b?o.friction:o.wallFriction;
   const trial=-kt*xi-gt*vt,ft=clamp(trial,-mu*fn,mu*fn);
   if(trial!==ft)xi=-(ft+gt*vt)/kt;
   if(record){record.x=xi*tx;record.y=xi*ty;record.stamp=this.serial;}else this.contacts.set(key,{x:xi*tx,y:xi*ty,stamp:this.serial});
   this.applyContact(a,b,nx,ny,fn,ft,overlap);
  }
  applyContact(a,b,nx,ny,fn,ft,overlap){
   const fx=fn*nx-ft*ny,fy=fn*ny+ft*nx;
   a.fx+=fx;a.fy+=fy;a.torque-=a.r*ft;
   if(b){b.fx-=fx;b.fy-=fy;b.torque-=b.r*ft;}
   this.maxPenetration=Math.max(this.maxPenetration,overlap/Math.min(a.r,b?b.r:a.r));
  }
  updateNeighbors(){
   if(!this.neighbors||this.grains.some(p=>Math.hypot(p.x-p.neighborX,p.y-p.neighborY)>this.skin/2)){
    this.neighbors=[];
    for(const [key,record]of this.contacts)if(record.stamp<this.serial-1)this.contacts.delete(key);
    const cell=2*this.maxR+this.skin,cols=Math.ceil(this.box.width/cell)+3,grid=new Map();
    for(const a of this.grains){
     a.neighborX=a.x;a.neighborY=a.y;const gx=Math.floor(a.x/cell),gy=Math.floor(a.y/cell);
     for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
      const list=grid.get(x+cols*y);if(list)for(const b of list)if((a.x-b.x)**2+(a.y-b.y)**2<(a.r+b.r+this.skin)**2)this.neighbors.push([a,b]);
     }
     const key=gx+cols*gy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(a);
    }
   }
  }
  nextDt(shake=true){
   if(this.options.solver==='hertz'){
    // Resolve both the elastic contact period and an impending Hertz collision.
    let speed=0;for(const p of this.grains)speed=Math.max(speed,Math.hypot(p.vx,p.vy));
    const wallSpeed=shake?this.options.amplitude/1000*2*Math.PI*this.options.frequency:0;
    const mass=BOX.density*Math.PI*this.minR**2*BOX.thickness*Math.min(1,this.options.densityRatio)/2;
    const collision=2.94*Math.pow(mass*mass/(this.minR/2*this.effectiveYoung**2*Math.max(2*speed+wallSpeed,.01)),.2);
    return Math.min(this.dt,collision/30,this.contactFrequency2>0?.04/Math.sqrt(this.contactFrequency2):Infinity);
   }
   if(this.options.solver!=='rigid')return this.dt;
   let maxSpeed=0;for(const p of this.grains)maxSpeed=Math.max(maxSpeed,Math.hypot(p.vx,p.vy));
   const acc=Math.abs(this.options.gravity+(shake?this.motion(this.time).a:0));
   return Math.min(this.dt,.2*this.minR/Math.max(maxSpeed,1e-8),Math.sqrt(.2*this.minR/Math.max(acc,1e-8)));
  }
  stepRigid(dt,shake){
   const body=-this.options.gravity-(shake?this.motion(this.time).a:0),active=[];
   this.serial++;this.maxPenetration=0;
   for(const p of this.grains){p.fx=0;p.fy=p.mass*body;p.torque=0;p.vy+=body*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
   this.updateNeighbors();
   const add=(a,b,nx,ny,overlap,key)=>{
    if(overlap<=0)return;
    const vn=(a.vx-(b?b.vx:0))*nx+(a.vy-(b?b.vy:0))*ny;
    const old=this.contacts.get(key),reuse=old&&old.stamp===this.serial-1&&old.normal!==undefined;
    active.push({a,b,nx,ny,overlap,key,normal:reuse?old.normal*dt/old.dt:0,tangent:reuse?old.tangent*dt/old.dt:0,target:!reuse&&vn<-.03?-this.options.restitution*vn:0});
    this.maxPenetration=Math.max(this.maxPenetration,overlap/Math.min(a.r,b?b.r:a.r));
   };
   for(const [a,b]of this.neighbors){
    const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);add(a,b,d?dx/d:1,d?dy/d:0,a.r+b.r-d,a.id*this.grains.length+b.id);
   }
   for(const a of this.grains){
    const key=this.grains.length**2+4*a.id;
    add(a,null,1,0,a.r-a.x,key);add(a,null,-1,0,a.x+a.r-this.box.width,key+1);
    add(a,null,0,1,a.r-a.y,key+2);add(a,null,0,-1,a.y+a.r-this.box.height,key+3);
   }
   for(const c of active){
    const {a,b,nx,ny}=c,tx=-ny,ty=nx,fx=nx*c.normal+tx*c.tangent,fy=ny*c.normal+ty*c.tangent;
    a.vx+=fx/a.mass;a.vy+=fy/a.mass;a.omega-=a.r*c.tangent/a.inertia;
    if(b){b.vx-=fx/b.mass;b.vy-=fy/b.mass;b.omega-=b.r*c.tangent/b.inertia;}
   }
   for(let pass=0;pass<8;pass++)for(let i=0;i<active.length;i++){
    const c=active[pass%2?active.length-1-i:i],{a,b,nx,ny}=c,tx=-ny,ty=nx;
    const inv=1/a.mass+(b?1/b.mass:0),vn=(a.vx-(b?b.vx:0))*nx+(a.vy-(b?b.vy:0))*ny;
    const old=c.normal;c.normal=Math.max(0,old+(c.target-vn)/inv);const jn=c.normal-old;
    a.vx+=nx*jn/a.mass;a.vy+=ny*jn/a.mass;
    if(b){b.vx-=nx*jn/b.mass;b.vy-=ny*jn/b.mass;}
    const vt=(a.vx-(b?b.vx:0))*tx+(a.vy-(b?b.vy:0))*ty-a.omega*a.r-(b?b.omega*b.r:0);
    const mu=b?this.options.friction:this.options.wallFriction,oldT=c.tangent;
    c.tangent=clamp(oldT-vt/(inv+a.r*a.r/a.inertia+(b?b.r*b.r/b.inertia:0)),-mu*c.normal,mu*c.normal);
    const jt=c.tangent-oldT;
    a.vx+=tx*jt/a.mass;a.vy+=ty*jt/a.mass;a.omega-=a.r*jt/a.inertia;
    if(b){b.vx-=tx*jt/b.mass;b.vy-=ty*jt/b.mass;b.omega-=b.r*jt/b.inertia;}
   }
   for(const c of active)this.contacts.set(c.key,{normal:c.normal,tangent:c.tangent,dt,stamp:this.serial});
   // Split positional projection resolves penetration without injecting kinetic energy.
   for(let pass=0;pass<5;pass++){
    this.updateNeighbors();
    for(const [a,b]of this.neighbors){
     const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),overlap=a.r+b.r-d;
     if(overlap>this.minR*.001){
      const correction=.8*(overlap-this.minR*.001)/(1/a.mass+1/b.mass),nx=d?dx/d:1,ny=d?dy/d:0;
      a.x+=nx*correction/a.mass;a.y+=ny*correction/a.mass;b.x-=nx*correction/b.mass;b.y-=ny*correction/b.mass;
     }
    }
    for(const a of this.grains){a.x=clamp(a.x,a.r,this.box.width-a.r);a.y=clamp(a.y,a.r,this.box.height-a.r);}
   }
   for(const p of this.grains){p.angle+=p.omega*dt;if(!Number.isFinite(p.x+p.y+p.omega))throw new Error('Numerical instability: reset the bed.');}
   if(shake){this.time+=dt;this.peakPenetration=Math.max(this.peakPenetration,this.maxPenetration);}else this.settleTime+=dt;
  }
  step(dt=this.nextDt(),shake=true){
   if(this.options.solver==='rigid')return this.stepRigid(dt,shake);
   this.serial++;
   const body=-this.options.gravity-(shake?this.motion(this.time).a:0),n=this.grains.length,skin=this.skin;
   this.maxPenetration=0;this.contactFrequency2=0;
   for(const p of this.grains){p.fx=0;p.fy=p.mass*body;p.torque=0;}
   this.updateNeighbors();
   for(const [a,b]of this.neighbors){
    const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy),overlap=a.r+b.r-d;
    if(overlap>0)this.contact(a,b,d?dx/d:1,d?dy/d:0,overlap,a.id*n+b.id,dt);
   }
   for(const a of this.grains){
    const key=n*n+4*a.id;
    this.contact(a,null,1,0,a.r-a.x,key,dt);
    this.contact(a,null,-1,0,a.x+a.r-this.box.width,key+1,dt);
    this.contact(a,null,0,1,a.r-a.y,key+2,dt);
    this.contact(a,null,0,-1,a.y+a.r-this.box.height,key+3,dt);
   }
   for(const p of this.grains){
    p.vx+=p.fx/p.mass*dt;p.vy+=p.fy/p.mass*dt;p.omega+=p.torque/p.inertia*dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.omega*dt;
    if(!Number.isFinite(p.x+p.y+p.vx+p.vy+p.omega)||Math.abs(p.x)>1||Math.abs(p.y)>1)throw new Error('Numerical instability: reset the bed.');
   }
   if(shake){this.time+=dt;this.peakPenetration=Math.max(this.peakPenetration,this.maxPenetration);}else this.settleTime+=dt;
  }
  prepareStep(){
   const dt=this.nextDt(false);this.step(dt,false);
   let speed=0;
   if(this.options.solver==='rigid')speed=Math.sqrt(this.grains.reduce((sum,p)=>sum+p.mass*(p.vx*p.vx+p.vy*p.vy)+p.inertia*p.omega*p.omega,0)/this.totalMass);
   else for(const p of this.grains)speed=Math.max(speed,Math.hypot(p.vx,p.vy)+Math.abs(p.omega)*p.r);
   this.quiet=this.settleTime>.15&&speed<.0015?this.quiet+dt:0;
   if(this.settleTime>=this.options.settleDuration&&(this.quiet>.1||this.settleTime>=3)){
    this.prepared=true;this.time=0;this.initial=this.stats();
   }
   return this.prepared;
  }
  stopShaking(){
   if(this.stoppedMotion)return;
   const motion=this.motion(this.time);this.stoppedMotion=motion;
   // Stop the wall at its current location; retain each particle's lab velocity.
   for(const p of this.grains)p.vy+=motion.v;
  }
  restStep(dt=this.nextDt(false)){
   this.stopShaking();const settle=this.settleTime;
   this.step(dt,false);this.settleTime=settle;this.restTime+=dt;
  }
  stats(){
   const mean=large=>{const ps=this.grains.filter(p=>p.large===large),m=ps.reduce((s,p)=>s+p.mass,0);return ps.reduce((s,p)=>s+p.mass*p.y,0)/m;};
   const largeMass=this.grains.reduce((sum,p)=>sum+(p.large?p.mass:0),0),totalMass=this.grains.reduce((sum,p)=>sum+p.mass,0);
   const large=mean(true),small=mean(false),height=Math.max(...this.grains.map(p=>p.y+p.r));
   const largeGrains=this.grains.filter(p=>p.large),smallGrains=this.grains.filter(p=>!p.large);
   const numberLarge=largeGrains.reduce((sum,p)=>sum+p.y,0)/largeGrains.length,numberSmall=smallGrains.reduce((sum,p)=>sum+p.y,0)/smallGrains.length;
   const largeAbove=[.25,.5,.75].map(f=>largeGrains.filter(p=>p.y>height*f).length/largeGrains.length);
   return {numberLarge,numberSmall,numberSeparation:numberLarge-numberSmall,largeAbove,large,small,height,largeMassFraction:largeMass/totalMass,separation:large-small,gamma:this.options.amplitude/1000*(2*Math.PI*this.options.frequency)**2/this.options.gravity,kinetic:this.grains.reduce((s,p)=>s+.5*p.mass*(p.vx*p.vx+p.vy*p.vy)+.5*p.inertia*p.omega*p.omega,0)};
  }
 }
 const api={BNEBed,DEFAULTS,MIXTURE_DEFAULTS,BOX,damping};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BNE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
