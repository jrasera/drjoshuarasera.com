const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./electrostatics-engine.js');
const C=require('./electrostatics-collectors.js');
test('force components sum to mass times acceleration on each axis',()=>{
 const batch=E.makeBatch(),p=batch.particles.find(p=>p.chargeMass>0),state=[0,.2,.3,1.2];
 const f=E.forceComponents(p,state,batch.options),a=E.acceleration(p,state,batch.options);
 for(const axis of ['x','y']){
  const sum=f.weight[axis]+f.buoyancy[axis]+f.electric[axis]+f.drag[axis];
  assert.ok(Math.abs(sum-f.net[axis])<1e-20);
  assert.ok(Math.abs(f.net[axis]-p.mass*a[axis])<1e-20);
 }
});
test('drag resolves into both components using one total relative speed',()=>{
 const b=E.makeBatch(),p=b.particles[0];
 const f=E.forceComponents(p,[0,.2,.3,1],b.options);
 assert.ok(f.drag.x<0&&f.drag.y<0);
 assert.ok(Math.abs(f.drag.x/f.drag.y-.3)<1e-12);
 const faster=E.forceComponents(p,[0,.2,.3,2],b.options);
 assert.ok(Math.abs(faster.drag.x)>Math.abs(f.drag.x));
});
test('electrostatic force is explicit qE, changes sign with polarity and is zero outside plates',()=>{
 const b=E.makeBatch(),p=b.particles.find(p=>p.chargeMass>0),s=[0,.2,0,1];
 const f=E.forceComponents(p,s,b.options);
 assert.equal(f.electric.x,p.mass*p.chargeMass*E.electricField(b.options));
 assert.equal(f.electric.y,0);
 assert.equal(E.forceComponents(p,s,{...b.options,reverse:true}).electric.x,-f.electric.x);
 assert.equal(E.forceComponents(p,[0,.6,0,1],b.options).electric.x,0);
});
test('vacuum removes x drag, y drag and buoyancy without removing weight or electrostatics',()=>{
 const b=E.makeBatch({air:false}),p=b.particles[0],f=E.forceComponents(p,[0,.2,1,1],b.options);
 assert.equal(f.drag.x,0);assert.equal(f.drag.y,0);assert.equal(f.buoyancy.y,0);
 assert.ok(f.weight.y>0);assert.ok(f.electric.x!==0);
});
test('inelastic two-disk contact conserves linear momentum and reduces kinetic energy',()=>{
 const a={x:0,y:0,r:1,vx:2,vy:.5,inv:1},b={x:1.9,y:0,r:1,vx:-1,vy:-.5,inv:.5};
 const momentum=()=>[a.vx/a.inv+b.vx/b.inv,a.vy/a.inv+b.vy/b.inv];
 const energy=()=>.5*((a.vx*a.vx+a.vy*a.vy)/a.inv+(b.vx*b.vx+b.vy*b.vy)/b.inv);
 const before=momentum(),kinetic=energy();C.contact(a,b);const after=momentum();
 assert.ok(Math.abs(before[0]-after[0])<1e-12);assert.ok(Math.abs(before[1]-after[1])<1e-12);assert.ok(energy()<=kinetic);
});
let pile,batch;
test('all uncharged grains enter a contact bed and form a laterally spread mound',()=>{
 batch=E.makeBatch({charging:0});pile=C.build(batch);
 assert.equal(pile.grains.length,120);assert.ok(pile.maxOverlap<.02);
 const span=Math.max(...pile.grains.map(a=>a.x))-Math.min(...pile.grains.map(a=>a.x));
 assert.ok(span>80);
 assert.ok(new Set(pile.grains.map(a=>a.y.toFixed(2))).size>80,'not fixed rows');
 for(const a of pile.grains){
  assert.ok(a.x-a.r>=a.left-1e-8&&a.x+a.r<=a.right+1e-8);
  assert.ok(a.y+a.r<=C.DEPTH+1e-8);
  assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
 }
 assert.equal(E.results(batch).bins.centre.counts.reduce((a,b)=>a+b,0),120);
});
test('collector seeking is deterministic, reversible and includes descent before settling',()=>{
 const p=pile.tracks.find(track=>track.length>5),index=pile.tracks.indexOf(p);
 const mid=(p[0].t+p[p.length-1].t)/2;
 const a=C.sample(pile,index,mid);C.sample(pile,index,pile.duration);
 assert.deepEqual(C.sample(pile,index,mid),a);
 assert.equal(C.sample(pile,index,p[0].t-.01),null);
 assert.ok(C.sample(pile,index,pile.duration).y>p[0].y);
});
test('downstream packing leaves all separation masses and destinations unchanged',()=>{
 const b=E.makeBatch(),before=E.results(b),s=C.build(b),after=E.results(b);
 assert.deepEqual(before,after);
 const useful=b.particles.filter(p=>['left','centre','right'].includes(p.destination)).length;
 assert.equal(s.grains.length,useful);
 assert.ok(s.maxOverlap<.02);
});

const fs=require('node:fs'),vm=require('node:vm');
test('the actual interface locks a grain, pauses, scrubs and steps its flight with explicit forces',()=>{
 class Element{
  constructor(){this.children=[];this.listeners={};this.textContent='';this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.dataset={};this.cells=[];}
  showModal(){this.open=true;}
  close(){this.open=false;this.emit('close');}
  focus(){this.focused=true;}
  append(v){this.children.push(v);}
  replaceChildren(){this.children=[];}
  set innerHTML(v){this.cells=Array.from({length:(v.match(/<(?:th|td)[ >]/g)||[]).length},()=>({textContent:''}));}
  setAttribute(k,v){this[k]=v;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  emit(k){for(const fn of this.listeners[k]||[])fn({target:this});}
  get text(){return this.textContent;}
  get options(){return this.children;}
  get selectedIndex(){return Math.max(0,this.children.findIndex(v=>String(v.value)===String(this.value)));}
  getBoundingClientRect(){return {width:800,height:650,left:0,top:0};}
  getContext(){return new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});}
 }
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 for(const [id,value]of Object.entries({'electro-voltage':'35','electro-charging':'85','electro-diameter':'200','electro-air':'air','electro-gravity':'9.81','electro-speed':'.25','electro-product':'left'}))get(id).value=value;
 get('electro-variation').checked=true;
 for(const value of ['left','centre','right']){const v=new Element();v.value=value;v.textContent=value+' collector';get('electro-product').append(v);}
 const frames=new Map();let next=1;
 const sandbox={window:{Electrostatics:E,CollectorBed:C,addEventListener(){}},
  document:{querySelector:()=>get('separator'),getElementById:get,createElement:()=>new Element(),querySelectorAll:()=>[],addEventListener(){}},
  matchMedia:()=>({matches:false}),devicePixelRatio:1,setTimeout:fn=>{fn();return 0;},clearTimeout(){},
  requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(fs.readFileSync(require.resolve('./research.js'),'utf8'),sandbox);
 const tick=stamp=>{const entry=frames.entries().next().value;if(entry){frames.delete(entry[0]);entry[1](stamp);}};
 get('electro-select-grain').emit('click');
 assert.equal(get('electro-settings').hidden,true);
 assert.equal(get('electro-tab-inspect')['aria-selected'],'true');
 assert.equal(get('electro-select-grain')['aria-expanded'],'true');
 assert.equal(get('electro-speed').value,'0.02');
 assert.equal(get('electro-inspection').hidden,false);
 const identity=String(get('electro-grain').value),before=get('electro-grain-state').textContent;
 assert.ok(before.includes('Between the electrodes'));
 const forceRows=get('electro-force-values').children;
 assert.equal(forceRows[0].cells[0].textContent,'Electrostatic qE');
 assert.ok(Number(forceRows[0].cells[1].textContent.replace('−','-'))!==0);
 assert.ok(Number(forceRows[1].cells[1].textContent.replace('−','-'))!==0);
 assert.ok(Number(forceRows[1].cells[2].textContent.replace('−','-'))!==0);
 get('electro-step').emit('click');
 assert.equal(String(get('electro-grain').value),identity);
 assert.notEqual(get('electro-grain-state').textContent,before);
 const stepped=get('electro-grain-state').textContent;
 get('electro-step-back').emit('click');assert.equal(get('electro-grain-state').textContent,before);
 get('electro-step').emit('click');assert.equal(get('electro-grain-state').textContent,stepped);
 get('run').emit('click');tick(1000);tick(1100);
 assert.equal(String(get('electro-grain').value),identity);
 assert.ok(get('electro-grain-state').textContent.includes('Grain #'+(Number(identity)+1)));
 get('run').emit('click');assert.equal(frames.size,0);
 get('electro-flight-progress').value='750';get('electro-flight-progress').emit('input');
 assert.equal(String(get('electro-grain').value),identity);
 assert.equal(get('electro-flight-value').textContent,'75.0%');
 get('run').emit('click');
 for(let stamp=1200;frames.size&&stamp<100000;stamp+=100)tick(stamp);
 assert.equal(frames.size,0);
 assert.ok(get('electro-status').textContent.startsWith('Paused just before grain #'));
 assert.equal(String(get('electro-grain').value),identity);
 get('electro-finish').emit('click');
 assert.equal(get('electro-results-dialog').open,true);
 assert.equal(get('electro-open-results').disabled,false);
 get('electro-close-results').emit('click');
 assert.equal(get('electro-results-dialog').open,false);
 assert.equal(get('electro-open-results').focused,true);
 get('electro-open-results').emit('click');
 assert.equal(get('electro-results-dialog').open,true);
 assert.equal(forceRows[0].cells[1].textContent,'—');
 assert.ok(get('electro-grain-state').textContent.includes('Flight ended'));
 get('electro-tab-experiment').emit('click');
 assert.equal(get('electro-settings').hidden,false);
 assert.equal(get('electro-inspection').hidden,true);
 assert.equal(get('electro-tab-experiment')['aria-selected'],'true');
 assert.equal(get('electro-select-grain')['aria-expanded'],'false');
 assert.equal(get('electro-speed').value,'.25');

});

test('collector entry preserves downward flight velocity before any collision at multiple display scales',()=>{
 for(const verticalScale of [250,615,1000]){
  const entry=.123,vy=2.5;
  const b={options:{diameter:200,gravity:9.81},duration:entry,particles:[{release:0,duration:entry,destination:'centre',diameter:.0002,mass:1e-8,final:[0,.65,0,vy]}]};
  const track=C.build(b,{verticalScale}).tracks[0],start=track[0],next=track.find(p=>p.t>entry&&p.y>0),dt=next.t-entry;
  assert.equal(start.y,0);
  assert.ok(Math.abs(next.y-(vy*verticalScale*dt+.5*9.81*verticalScale*dt*dt))<1e-8);
 }
});
