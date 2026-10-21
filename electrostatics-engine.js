/* Dilute, spherical-grain teaching model. SI units throughout; no fitted charging law. */
(function (root) {
 'use strict';
 const GEOMETRY = Object.freeze({gap: 0.15, fieldTop: 0.05, fieldBottom: 0.55, collectorY: 0.65, collectorWidth: 0.24, cut: 0.025});
 const DEFAULTS = Object.freeze({voltage: 35, charging: 85, diameter: 200, air: true, gravity: 9.81, reverse: false, variation: true, seed: 74129});
 const MATERIALS = Object.freeze([
  {name: 'Ilmenite model', density: 4570, colour: '#e6ad84', meanCharge: 2.2},
  {name: 'Silica model', density: 2650, colour: '#8ed0df', meanCharge: -5}
 ]);
 function random(seed) {
  let state = seed >>> 0;
  return () => {state = (Math.imul(1664525, state) + 1013904223) >>> 0; return (state + 0.5) / 4294967296;};
 }
 function normal(rng) {return Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());}
 function electricField(options) {return (options.reverse ? 1 : -1) * options.voltage * 1000 / GEOMETRY.gap;}
 function mass(diameter, density) {return density * Math.PI * diameter ** 3 / 6;}
 // Constant-potential approximation: q ∝ d, hence q/m ∝ d^-2.
 // Reference charge-to-mass distributions are specified at 200 µm.
 function chargeMassAtDiameter(reference, diameter) {return reference * (200e-6 / diameter) ** 2;}
 function acceleration(p, state, options) {
  const [x, y, vx, vy] = state;
  const rho = options.air ? 1.204 : 0, mu = 1.825e-5, speed = Math.hypot(vx, vy);
  const re = rho * speed * p.diameter / mu;
  // Algebraic Stokes limit avoids division by zero at zero relative speed.
  const dragRate = !options.air ? 0 : re < 1000
   ? 3 * Math.PI * mu * p.diameter / p.mass * (1 + 0.15 * re ** 0.687)
   : 0.5 * rho * 0.44 * Math.PI * p.diameter ** 2 / 4 * speed / p.mass;
  const electric = y >= GEOMETRY.fieldTop && y < GEOMETRY.fieldBottom ? p.chargeMass * electricField(options) : 0;
  const down = options.gravity * (1 - rho / p.density);
  return {x: electric - dragRate * vx, y: down - dragRate * vy, electric, down, dragX: -dragRate * vx, dragY: -dragRate * vy};
 }
 function forceComponents(p,state,options){
  const a=acceleration(p,state,options),m=p.mass;
  const weight={x:0,y:m*options.gravity};
  const buoyancy={x:0,y:options.air?-m*options.gravity*1.204/p.density:0};
  const electric={x:m*a.electric,y:0};
  const drag={x:a.dragX===0?0:m*a.dragX,y:a.dragY===0?0:m*a.dragY};
  return {weight,buoyancy,electric,drag,net:{x:m*a.x,y:m*a.y}};
 }
 function derivative(p, s, o) {const a = acceleration(p, s, o); return [s[2], s[3], a.x, a.y];}
 function rk4(p, state, dt, options) {
  const add = (a, b, factor) => a.map((v, i) => v + b[i] * factor);
  const a = derivative(p, state, options), b = derivative(p, add(state, a, dt / 2), options);
  const c = derivative(p, add(state, b, dt / 2), options), d = derivative(p, add(state, c, dt), options);
  return state.map((v, i) => v + dt / 6 * (a[i] + 2*b[i] + 2*c[i] + d[i]));
 }
 function flight(p, options, dt = 0.001) {
  let state = [p.x, p.y, p.vx, p.vy], time = 0, nextSample = 0.008;
  const path = [{t: 0, state: state.slice()}];
  for (let n = 0; n < 30000 / (dt / 0.001); n++) {
   const next = rk4(p, state, dt, options);
   const events = [];
   // Side plates exist only across the field region. Particle radii are physical.
   const limit = GEOMETRY.gap / 2 - p.diameter / 2;
   for (const [edge, destination] of [[-limit, 'leftPlate'], [limit, 'rightPlate']]) {
    if ((state[0] - edge) * (next[0] - edge) <= 0 && next[0] !== state[0]) {
     const f = (edge - state[0]) / (next[0] - state[0]);
     const y = state[1] + (next[1] - state[1]) * f;
     if (f >= 0 && f <= 1 && y >= GEOMETRY.fieldTop && y <= GEOMETRY.fieldBottom) events.push({f, destination});
    }
   }
   if (next[1] >= GEOMETRY.collectorY) {
    const f = (GEOMETRY.collectorY - state[1]) / (next[1] - state[1]);
    const x = state[0] + (next[0] - state[0]) * f;
    events.push({f, destination: Math.abs(x) > GEOMETRY.collectorWidth/2 ? 'missed' : x < -GEOMETRY.cut ? 'left' : x > GEOMETRY.cut ? 'right' : 'centre'});
   }
   if (events.length) {
    const event = events.sort((a,b) => a.f-b.f)[0];
    const final = state.map((v,i) => v+(next[i]-v)*event.f);
    time += dt*event.f;path.push({t:time,state:final});
    return {path, duration:time, destination:event.destination, final};
   }
   state = next;time += dt;
   if (time + 1e-10 >= nextSample) {path.push({t:time,state:state.slice()});nextSample += 0.008;}
  }
  throw new Error('Particle did not reach an electrode or collector within 30 seconds.');
 }
 function makeBatch(input = {}) {
  const options = {...DEFAULTS, ...input}, rng = random(options.seed), particles = [];
  // Equal approximate feed mass: fewer of the denser ilmenite grains.
  const order = Array.from({length:120}, (_,i) => i < 44 ? 0 : 1);
  for (let i=order.length-1;i>0;i--) {const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for (let i=0;i<order.length;i++) {
   const kind=order[i], material=MATERIALS[kind], spread=normal(rng);
   const sizeFactor=0.85+0.30*rng();
   const diameter=options.diameter*1e-6*(options.variation ? sizeFactor : 1);
   const specific=(material.meanCharge+(options.variation ? spread*(kind===0?3.0:4.0) : 0))*options.charging/100*1e-6;
   const p={kind,diameter,density:material.density,mass:mass(diameter,material.density),chargeMass:chargeMassAtDiameter(specific,diameter),
    x:(rng()-0.5)*0.002,y:0,vx:0,vy:0.4,release:i/119*1.0};
   const result=flight(p,options);
   particles.push({...p,...result});
  }
  return {options,particles,duration:Math.max(...particles.map(p=>p.release+p.duration))};
 }
 function sample(p, time) {
  const t = time - p.release;
  if (t < 0) return null;
  if (t >= p.duration) return {state:p.final,done:true};
  let lo=0,hi=p.path.length-1;
  while (hi-lo>1) {const mid=(lo+hi)>>1;if(p.path[mid].t<=t)lo=mid;else hi=mid;}
  const a=p.path[lo],b=p.path[hi],f=(t-a.t)/(b.t-a.t);
  return {state:a.state.map((v,i)=>v+(b.state[i]-v)*f),done:false};
 }
 function results(batch, time = Infinity, product = 'left') {
  const bins=Object.fromEntries(['left','centre','right','leftPlate','rightPlate','missed'].map(k=>[k,{counts:[0,0],mass:[0,0]}]));
  const feed=[0,0];let collected=0;
  for(const p of batch.particles) {
   feed[p.kind]+=p.mass;
   if(time+1e-8>=p.release+p.duration) {const b=bins[p.destination];b.counts[p.kind]++;b.mass[p.kind]+=p.mass;collected++;}
  }
  for(const bin of Object.values(bins)){
   const total=bin.mass[0]+bin.mass[1];
   bin.grade=bin.mass.map(m=>total?m/total:null);
   bin.recovery=bin.mass.map((m,i)=>feed[i]?m/feed[i]:null);
  }
  const target=bins[product],total=feed[0]+feed[1],productMass=target.mass[0]+target.mass[1];
  return {bins,collected,feedGrade:feed[0]/total,
   grade:productMass?target.mass[0]/productMass:null,recovery:target.mass[0]/feed[0],
   plateLoss:(bins.leftPlate.mass.reduce((a,b)=>a+b,0)+bins.rightPlate.mass.reduce((a,b)=>a+b,0))/total};
 }
 const api={GEOMETRY,DEFAULTS,MATERIALS,chargeMassAtDiameter,forceComponents,electricField,mass,acceleration,rk4,flight,makeBatch,sample,results};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Electrostatics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
