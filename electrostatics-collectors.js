/* Display-scale collector bed. Enlarged non-rotating disks, not calibrated mineral DEM.
   Fixed-step gravity, inelastic impulses, Coulomb-limited sliding and overlap constraints.
   This downstream illustration never changes the SI flight model or collection accounting. */
(function(root){
 'use strict';
 const WIDTH=720,DEPTH=100,DT=1/240,CUTS=[-0.12,-0.025,0.025,0.12];
 const X=x=>(x+.14)/.28*WIDTH;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function boundaries(a){
  if(a.x<a.left+a.r){a.x=a.left+a.r;if(a.vx<0)a.vx=-a.vx*.08;}
  if(a.x>a.right-a.r){a.x=a.right-a.r;if(a.vx>0)a.vx=-a.vx*.08;}
  if(a.y+a.r>DEPTH){
   a.y=DEPTH-a.r;
   if(a.vy>0){const before=a.vy;a.vy=before>20?-before*.08:0;a.vx-=Math.sign(a.vx)*Math.min(Math.abs(a.vx),.55*(before-a.vy));}
  }
 }
 function contact(a,b){
  let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),sum=a.r+b.r;
  if(dist>=sum)return;
  if(dist<1e-8){dx=.001;dy=0;dist=.001;}
  const nx=dx/dist,ny=dy/dist,inv=a.inv+b.inv,penetration=sum-dist;
  const correction=Math.max(0,penetration-.001)*.85/inv;
  a.x-=nx*correction*a.inv;a.y-=ny*correction*a.inv;b.x+=nx*correction*b.inv;b.y+=ny*correction*b.inv;
  const rvx=b.vx-a.vx,rvy=b.vy-a.vy,closing=rvx*nx+rvy*ny;
  if(closing>=0)return;
  const normal=-(1+(closing < -20?.08:0))*closing/inv;
  const tangent=clamp(-(rvx*(-ny)+rvy*nx)/inv,-.55*normal,.55*normal);
  const ix=normal*nx-tangent*ny,iy=normal*ny+tangent*nx;
  a.vx-=ix*a.inv;a.vy-=iy*a.inv;b.vx+=ix*b.inv;b.vy+=iy*b.inv;
 }
 function pairs(grains){
  const grid=new Map(),out=[],cell=12;
  for(const a of grains){
   const gx=Math.floor(a.x/cell),gy=Math.floor(a.y/cell);
   for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++){
    const list=grid.get(x+','+y);if(list)for(const b of list)if(a.bin===b.bin)out.push([a,b]);
   }
   const key=gx+','+gy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(a);
  }
  return out;
 }
 function maxOverlap(grains){
  let worst=0;
  for(const [a,b]of pairs(grains))worst=Math.max(worst,a.r+b.r-Math.hypot(a.x-b.x,a.y-b.y));
  return worst;
 }
 function build(batch,{verticalScale=400/.65}={}){
  const order=batch.particles.map((p,i)=>({p,i,t:p.release+p.duration})).filter(v=>['left','centre','right'].includes(v.p.destination)).sort((a,b)=>a.t-b.t||a.i-b.i);
  const tracks=batch.particles.map(()=>[]),active=[],gravity=verticalScale*batch.options.gravity;
  let cursor=0,time=0,quiet=0;
  const end=batch.duration+4;
  for(let step=0;time<end;step++){
   time=step*DT;
   while(cursor<order.length&&order[cursor].t<=time+1e-10){
    const {p,i}=order[cursor++],bin=['left','centre','right'].indexOf(p.destination),r=4.2*p.diameter/(batch.options.diameter*1e-6);
    const a={i,bin,r,inv:1/(p.mass/1e-8),left:X(CUTS[bin]),right:X(CUTS[bin+1]),x:X(p.final[0]),y:0,
     entry:order[cursor-1].t,vx:p.final[2]*WIDTH/.28,vy:p.final[3]*verticalScale};
    a.x=clamp(a.x,a.left+r,a.right-r);active.push(a);
    tracks[i].push({t:order[cursor-1].t,x:a.x,y:0,r:a.r});
   }
   for(const a of active){const dt=Math.min(DT,Math.max(0,time-a.entry));a.x+=a.vx*dt;a.y+=a.vy*dt+.5*gravity*dt*dt;a.vy+=gravity*dt;boundaries(a);}
   const near=pairs(active);
   for(let pass=0;pass<14;pass++){
    for(let n=0;n<near.length;n++){const [a,b]=near[pass%2?near.length-1-n:n];contact(a,b);}
    for(const a of active)boundaries(a);
   }
   if(step%2===0)for(const a of active)tracks[a.i].push({t:time,x:a.x,y:a.y,r:a.r});
   const maxSpeed=Math.max(0,...active.map(a=>Math.hypot(a.vx,a.vy)));
   if(time>batch.duration+.4&&maxSpeed<3&&maxOverlap(active)<.4)quiet+=DT;else quiet=0;
   if(quiet>.25)break;
  }
  // Extra geometric constraint passes remove small residual penetrations without arranging rows.
  for(let pass=0;pass<1200;pass++){for(const [a,b]of pairs(active))contact(a,b);for(const a of active)boundaries(a);}
  for(const a of active)tracks[a.i].push({t:time+DT,x:a.x,y:a.y,r:a.r});
  return {tracks,duration:time+DT,width:WIDTH,depth:DEPTH,grains:active,maxOverlap:maxOverlap(active)};
 }
 function sample(settlement,index,time){
  const path=settlement.tracks[index];if(!path.length||time<path[0].t)return null;
  if(time>=path[path.length-1].t)return path[path.length-1];
  let lo=0,hi=path.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(path[mid].t<=time)lo=mid;else hi=mid;}
  const a=path[lo],b=path[hi],f=(time-a.t)/(b.t-a.t||1);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,r:a.r};
 }
 const api={build,sample,contact,maxOverlap,WIDTH,DEPTH};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CollectorBed=api;
})(typeof globalThis!=='undefined'?globalThis:this);
