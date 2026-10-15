/* A guided illustration with local settling, not a calibrated DEM model. */
(function (root) {
 class BNEBed {
  constructor(width,height,ratio=3,seed=87413){this.configure(width,height);this.frequency=30;this.amplitude=.35;this.playbackRate=1/30;this.reset(ratio,seed)}
  configure(width,height){
   this.width=width;this.height=height;this.boxWidth=Math.min(420,width*.78);
   this.left=(width-this.boxWidth)/2;this.right=this.left+this.boxWidth;this.top=62;this.bottom=height-57;
   this.radius=this.boxWidth/30;this.clearance=this.radius*.08;this.fixedDt=1/120;
  }
  setVibration(frequency,amplitude,playbackRate=this.playbackRate){this.frequency=Math.max(0,Math.min(70,frequency));this.amplitude=Math.max(0,Math.min(1,amplitude));this.playbackRate=playbackRate;this.accumulator=0;}
  get cycleRate(){return this.amplitude>0?this.frequency*this.playbackRate:0}
  random(){this.randomSeed=(this.randomSeed*16807)%2147483647;return(this.randomSeed-1)/2147483646}
  reset(ratio=this.ratio,seed=this.seed){
   this.ratio=ratio;this.seed=seed;this.randomSeed=seed;this.cycle=0;this.accumulator=0;this.grains=[];
   const r=this.radius;
   for(let row=0;row<9;row++)for(let col=0;col<14;col++){
    this.grains.push({x:this.left+r*1.1+col*r*2.04+(row%2)*r*.15,y:this.top+r*1.1+row*r*2.06,rad:r*(.87+this.random()*.12),vx:0,vy:0,large:false});
   }
   this.large=[{large:true,vx:0,vy:0},{large:true,vx:0,vy:0}];this.updateLarge();
   // Settle once before presenting the initial mixture.
   for(let i=0;i<420;i++)this.integrate(this.fixedDt,false);
   this.project(220);
   for(const grain of this.grains){grain.vx=0;grain.vy=0}
  }
  updateLarge(){
   const R=this.radius*this.ratio;
   const depth=(126*Math.PI*this.radius*this.radius+2*Math.PI*R*R)/(this.boxWidth*.8);
   const target=Math.max(this.top+R+8,this.bottom-depth+R+this.radius+8),base=this.bottom-R-this.clearance;
   const progress=Math.max(0,Math.min(this.cycle/16,1));
   const rise=(base-target)*(this.ratio-1)/2*progress;
   for(let i=0;i<2;i++){this.large[i].x=(this.left+this.right)/2+(i?1:-1)*this.boxWidth*.20;this.large[i].y=base-rise*(i?.9:1);this.large[i].rad=R;}
  }
  candidates(){
   const particles=[...this.grains,...this.large],cellSize=this.radius*this.ratio*2+this.clearance*2,grid=new Map(),pairs=[];
   for(let i=0;i<particles.length;i++){
    const a=particles[i],gx=Math.floor(a.x/cellSize),gy=Math.floor(a.y/cellSize);
    for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
     const cell=grid.get(x+','+y);if(!cell)continue;
     for(const j of cell)if(!(a.large&&particles[j].large))pairs.push([particles[j],a]);
    }
    const key=gx+','+gy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
   }
   return pairs;
  }
  clamp(){
   const gap=this.clearance*.5;
   for(const a of this.grains){a.x=Math.max(this.left+a.rad+gap,Math.min(this.right-a.rad-gap,a.x));a.y=Math.max(this.top+a.rad+gap,Math.min(this.bottom-a.rad-gap,a.y));}
  }
  project(maxPasses=90){
   let pairs=this.candidates();const tolerance=this.clearance*.07;
   for(let pass=0;pass<maxPasses;pass++){
    if(pass&&pass%24===0)pairs=this.candidates();
    const reverse=pass%2;
    for(let n=0;n<pairs.length;n++){
     const pair=pairs[reverse?pairs.length-1-n:n],a=pair[0],b=pair[1];
     let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
     const distance=a.rad+b.rad+this.clearance;if(d2>=distance*distance)continue;
     if(d2<1e-12){dx=.0001;dy=.00013;d2=dx*dx+dy*dy}
     const d=Math.sqrt(d2),correction=distance-d,nx=dx/d,ny=dy/d;
     const ia=a.large?0:1/(a.rad*a.rad),ib=b.large?0:1/(b.rad*b.rad),sum=ia+ib;
     if(!sum)continue;
     a.x-=nx*correction*ia/sum;a.y-=ny*correction*ia/sum;
     b.x+=nx*correction*ib/sum;b.y+=ny*correction*ib/sum;
    }
    this.clamp();
    if(pass>=5&&pass%3===2){
     let penetration=0;
     for(const [a,b]of pairs)penetration=Math.max(penetration,a.rad+b.rad+this.clearance-Math.hypot(b.x-a.x,b.y-a.y));
     if(penetration<tolerance)break;
    }
   }
  }
  integrate(dt,advanceCycle=true,cycleRate=this.cycleRate){
   if(advanceCycle){this.cycle=Math.min(16,this.cycle+dt*cycleRate);this.updateLarge()}
   const gravity=this.radius*65;
   // All positions are local to the container. No random force is added per frame.
   for(const a of this.grains){a.oldX=a.x;a.oldY=a.y;a.vx*=Math.exp(-4*dt);a.vy+=gravity*dt;a.x+=a.vx*dt;a.y+=a.vy*dt;}
   this.project();
   for(const a of this.grains){
    a.vx=(a.x-a.oldX)/dt*.90;a.vy=(a.y-a.oldY)/dt*.90;
    if(Math.abs(a.vx)<.01)a.vx=0;if(Math.abs(a.vy)<.01)a.vy=0;
   }
  }
  advance(seconds){
   if(this.cycleRate===0){this.accumulator=0;return}
   this.accumulator+=Math.min(seconds,.1);
   while(this.accumulator+1e-10>=this.fixedDt&&this.cycle<16){this.integrate(this.fixedDt);this.accumulator-=this.fixedDt;}
  }
  setCycle(value){
   const target=Math.max(0,Math.min(16,value));
   if(target<this.cycle-1e-8)this.reset(this.ratio,this.seed);
   const previewRate=Math.max(this.cycleRate,1);
   while(this.cycle<target-1e-8)this.integrate(Math.min(this.fixedDt,(target-this.cycle)/previewRate),true,previewRate);
   this.cycle=target;this.accumulator=0;this.updateLarge();this.project(220);
  }
  get containerShift(){return Math.sin(this.cycle*Math.PI*2)*this.amplitude*Math.min(18,this.boxWidth*.045)}
  maxOverlap(){
   const all=[...this.grains,...this.large];let worst=0;
   for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)worst=Math.max(worst,all[i].rad+all[j].rad-Math.hypot(all[i].x-all[j].x,all[i].y-all[j].y));
   return worst;
  }
 }
 if(typeof module!=='undefined'&&module.exports)module.exports=BNEBed;else root.BNEBed=BNEBed;
})(typeof globalThis!=='undefined'?globalThis:this);
