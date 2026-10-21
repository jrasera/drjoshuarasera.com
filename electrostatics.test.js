const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./electrostatics-engine.js');
const vacuum={...E.DEFAULTS,air:false};
const particle=(extra={})=>({kind:0,x:0,y:0.1,vx:0,vy:0.4,diameter:0.0002,density:4570,mass:E.mass(0.0002,4570),chargeMass:2e-6,...extra});
test('uniform field equals total potential difference divided by gap',()=>{
 assert.equal(E.electricField({...vacuum,voltage:30}),-200000);
 assert.equal(E.electricField({...vacuum,voltage:30,reverse:true}),200000);
});
test('RK4 reproduces analytic constant-field ballistic motion',()=>{
 const p=particle(),s=[0,0.1,0,0.4],dt=.03,a=p.chargeMass*E.electricField(vacuum),n=E.rk4(p,s,dt,vacuum);
 assert.ok(Math.abs(n[0]-a*dt*dt/2)<1e-12);
 assert.ok(Math.abs(n[1]-(.1+.4*dt+vacuum.gravity*dt*dt/2))<1e-12);
});
test('neutral grain has no electrical deflection',()=>{
 const p=particle({chargeMass:0,y:0});const f=E.flight(p,vacuum);
 assert.equal(f.final[0],0);assert.equal(f.destination,'centre');
});
test('zero voltage removes electrical force even when charged',()=>{
 const p=particle();assert.ok(E.acceleration(p,[0,.1,0,0],{...vacuum,voltage:0}).electric===0);
});
test('field acts only between the plate ends',()=>{
 const p=particle();assert.equal(E.acceleration(p,[0,0,0,0],vacuum).electric,0);
 assert.equal(E.acceleration(p,[0,.6,0,0],vacuum).electric,0);
});
test('reversing electrodes mirrors a flight',()=>{
 const p=particle({y:0}),a=E.flight(p,vacuum),b=E.flight(p,{...vacuum,reverse:true});
 assert.ok(Math.abs(a.final[0]+b.final[0])<1e-9);assert.ok(Math.abs(a.duration-b.duration)<1e-9);
});
test('charge sign reverses electric force; equal q/m has equal vacuum acceleration',()=>{
 const p=particle(),a=E.acceleration(p,[0,.1,0,0],vacuum);
 assert.equal(E.acceleration({...p,chargeMass:-p.chargeMass},[0,.1,0,0],vacuum).x,-a.x);
 assert.equal(E.acceleration({...p,mass:p.mass*2,density:p.density*2},[0,.1,0,0],vacuum).x,a.x);
});
test('drag opposes velocity and is finite at rest',()=>{
 const p=particle(),o={...vacuum,air:true},a=E.acceleration(p,[0,.1,1,-2],o),b=E.acceleration(p,[0,.1,0,0],o);
 assert.ok(a.dragX<0&&a.dragY>0);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
});
test('Earth and Moon vacuum falls match analytic flight time',()=>{
 for(const gravity of [9.81,1.62]){
  const p=particle({y:0,chargeMass:0}),o={...vacuum,gravity},f=E.flight(p,o);
  const exact=(-p.vy+Math.sqrt(p.vy**2+2*gravity*E.GEOMETRY.collectorY))/gravity;
  assert.ok(Math.abs(f.duration-exact)<1e-6);
 }
});
test('electrode impact terminates the trajectory at the physical surface',()=>{
 const p=particle({chargeMass:30e-6}),f=E.flight(p,vacuum);
 assert.equal(f.destination,'leftPlate');assert.ok(Math.abs(f.final[0]+E.GEOMETRY.gap/2-p.diameter/2)<1e-10);
});
test('air slows a neutral grain compared with vacuum',()=>{
 const p=particle({y:0,chargeMass:0});
 assert.ok(E.flight(p,{...vacuum,air:true}).duration>E.flight(p,vacuum).duration);
});
test('halving the time step converges across field boundaries',()=>{
 for(const air of [true,false]){
  const p=particle({y:0}),o={...vacuum,air},a=E.flight(p,o,.001),b=E.flight(p,o,.0005);
  assert.equal(a.destination,b.destination);assert.ok(Math.abs(a.final[0]-b.final[0])<.0002);
  assert.ok(Math.abs(a.duration-b.duration)<.0002);
 }
});
test('batches are reproducible and conserve grain counts and mass',()=>{
 const a=E.makeBatch(),b=E.makeBatch(),r=E.results(a);
 assert.deepEqual(a,b);assert.equal(r.collected,120);
 assert.equal(Object.values(r.bins).reduce((s,b)=>s+b.counts[0]+b.counts[1],0),120);
 const total=a.particles.reduce((s,p)=>s+p.mass,0),bins=Object.values(r.bins).reduce((s,b)=>s+b.mass[0]+b.mass[1],0);
 assert.ok(Math.abs(total-bins)<1e-18);
 for(const p of a.particles)assert.ok(p.path.every(v=>v.state.every(Number.isFinite)));
});
test('uncharged and zero-voltage batches collect in the centre',()=>{
 for(const options of [{charging:0},{voltage:0}]){
  const r=E.results(E.makeBatch(options));assert.equal(r.bins.centre.counts[0]+r.bins.centre.counts[1],120);assert.equal(r.plateLoss,0);
 }
});
test('purity and recovery are mass-weighted, not grain-count percentages',()=>{
 const batch={particles:[{kind:0,mass:4,release:0,duration:1,destination:'left'},{kind:1,mass:1,release:0,duration:1,destination:'left'},{kind:0,mass:4,release:0,duration:1,destination:'centre'}]};
 const r=E.results(batch);assert.equal(r.grade,.8);assert.equal(r.recovery,.5);assert.equal(E.results(batch,0).grade,null);
});

test('field-free flight below the plates retains horizontal momentum in vacuum',()=>{
 const p=particle({y:0,chargeMass:.8e-6}),o={...vacuum,voltage:35},f=E.flight(p,o);
 const t=y=>(-p.vy+Math.sqrt(p.vy**2+2*o.gravity*y))/o.gravity;
 const ta=t(E.GEOMETRY.fieldTop),tb=t(E.GEOMETRY.fieldBottom),tc=t(E.GEOMETRY.collectorY);
 const ax=p.chargeMass*E.electricField(o),expected=.5*ax*(tb-ta)**2+ax*(tb-ta)*(tc-tb);
 assert.ok(Math.abs(f.final[0]-expected)<.00003);
});
test('a grain missing the finite-width collectors is accounted for separately',()=>{
 const p=particle({x:.115,y:.60,vx:1,chargeMass:0}),f=E.flight(p,vacuum);
 assert.equal(f.destination,'missed');
});
test('allowed size, atmosphere and gravity extremes stay finite and conserve counts',()=>{
 for(const diameter of [100,500])for(const air of [false,true])for(const gravity of [1.62,9.81]){
  const b=E.makeBatch({diameter,air,gravity,voltage:50,charging:100}),r=E.results(b);
  assert.equal(r.collected,120);assert.ok(Number.isFinite(b.duration));assert.ok(b.duration<30);
  assert.ok(r.recovery>=0&&r.recovery<=1);assert.ok(r.plateLoss>=0&&r.plateLoss<=1);
 }
});

test('diameter changes charge linearly, mass cubically and electric acceleration inversely with diameter squared',()=>{
 const batches=[100,200,400].map(diameter=>E.makeBatch({diameter,variation:false,air:false,charging:100}));
 for(let i=0;i<120;i++){
  const [a,b,c]=batches.map(v=>v.particles[i]);
  const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10);
  close((b.chargeMass*b.mass)/(a.chargeMass*a.mass),2);
  close(c.mass/b.mass,8);
  close(a.chargeMass/b.chargeMass,4);
  close(b.chargeMass/c.chargeMass,4);
  close(E.acceleration(a,[0,.1,0,0],batches[0].options).electric/E.acceleration(b,[0,.1,0,0],batches[1].options).electric,4);
 }
});
test('charge scaling uses each varied grain diameter and preserves its reference charge sign',()=>{
 const a=E.makeBatch({diameter:100}),b=E.makeBatch({diameter:200});
 for(let i=0;i<a.particles.length;i++){
  assert.ok(Math.abs(a.particles[i].chargeMass/b.particles[i].chargeMass-4)<1e-10);
  assert.equal(Math.sign(a.particles[i].chargeMass),Math.sign(b.particles[i].chargeMass));
 }
});

test('each cut reports both mineral grades and recoveries by mass, including empty cuts',()=>{
 const b={particles:[{kind:0,mass:4,release:0,duration:1,destination:'left'},{kind:1,mass:1,release:0,duration:1,destination:'left'},{kind:0,mass:4,release:0,duration:1,destination:'centre'},{kind:1,mass:3,release:0,duration:1,destination:'right'}]};
 const r=E.results(b);
 assert.deepEqual(r.bins.left.grade,[.8,.2]);assert.deepEqual(r.bins.left.recovery,[.5,.25]);
 assert.deepEqual(r.bins.centre.grade,[1,0]);assert.deepEqual(r.bins.right.recovery,[0,.75]);
 assert.deepEqual(r.bins.leftPlate.grade,[null,null]);assert.deepEqual(r.bins.leftPlate.recovery,[0,0]);
 for(let k=0;k<2;k++)assert.equal(Object.values(r.bins).reduce((sum,v)=>sum+v.recovery[k],0),1);
});
