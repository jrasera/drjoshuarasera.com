const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {BNEBed}=require('./bne-engine.js');
test('workbench runs both sample modes, locks active settings and opens/closes results',()=>{
 class Element{
  constructor(value=''){this.value=value;this.disabled=false;this.textContent='';this.textWrites=0;this.listeners={};this.open=false;this.width=0;this.height=0;}
  set textContent(value){this._textContent=value;this.textWrites=(this.textWrites||0)+1;}
  get textContent(){return this._textContent;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  emit(k){this.listeners[k]?.({target:this});}
  setAttribute(k,v){this[k]=v;}
  getBoundingClientRect(){return {width:700,height:500,left:0,right:700,top:0,bottom:500};}
  getContext(){return new Proxy({},{get:()=>()=>{}});}
  showModal(){assert.equal(this.open,false);this.open=true;}
  close(){this.open=false;this.emit('close');}
  focus(){this.focused=true;}
 }
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const defaults={mode:'intruder',solver:'soft',initialization:'layered','small-min':.8,'small-max':1,'large-min':1.2,'large-max':1.4,width:80,height:120,'wall-friction':.45,contrast:3,frequency:25,amplitude:1,duration:10,count:160,'large-count':8,friction:.45,restitution:.6,density:1,playback:.5,young:63,poisson:.16,'normal-damping':0,'shear-damping':0};
 for(const [id,value]of Object.entries(defaults))get('bne-'+id).value=String(value);
 const workers=[];
 class Worker{
  constructor(){this.messages=[];workers.push(this);}
  postMessage(message){this.messages.push(message);}
  terminate(){this.terminated=true;}
  emit(message){this.onmessage({data:message});}
 }
 const sandbox={document:{getElementById:get,addEventListener(){}},window:{addEventListener(){}},Worker,devicePixelRatio:1};
 vm.runInNewContext(fs.readFileSync(require.resolve('./bne.js'),'utf8'),sandbox);
 assert.equal(get('bne-play').disabled,true);
 const bed=new BNEBed({smallCount:80}),initial=bed.stats();
 const data={type:'ready',time:0,settleTime:1,options:bed.options,dt:bed.dt,initial,stats:initial,motion:{y:0},overlap:0,history:[],grains:bed.grains};
 workers[0].emit(data);
 assert.equal(get('bne-play').disabled,false);assert.equal(get('bne-large-count').disabled,true);assert.equal(get('bne-large-count').value,'1');assert.equal(get('bne-large-count-value').textContent,'1');
 get('bne-play').emit('click');
 assert.equal(workers[0].messages.at(-1).type,'run');assert.equal(get('bne-frequency').disabled,true);
 const writes=get('bne-play').textWrites,runId=workers[0].messages.at(-1).commandId;
 for(let i=1;i<=10;i++)workers[0].emit({...data,type:'frame',commandId:runId,time:i/10});
 assert.equal(get('bne-play').textWrites,writes,'animation must not replace the button text during a click');
 get('bne-play').emit('click');assert.equal(workers[0].messages.at(-1).type,'pause');
 assert.equal(get('bne-play').disabled,true);
 const pause=workers[0].messages.at(-1);
 get('bne-play').emit('click');assert.equal(workers[0].messages.at(-1),pause);
 workers[0].emit({...data,type:'frame',commandId:pause.commandId-1,time:2});
 assert.equal(get('bne-play').textContent,'Pausing…');
 workers[0].emit({...data,type:'paused',commandId:pause.commandId,time:.25});
 assert.equal(get('bne-play').textContent,'Resume ▶');assert.equal(get('bne-play').disabled,false);
 workers[0].emit({...data,type:'done',commandId:pause.commandId-1,time:10});
 assert.equal(get('bne-results').open,false);
 const messageCount=workers[0].messages.length;
 get('bne-view-height').value='20';get('bne-view-height').emit('input');
 get('bne-view-bottom').value='15';get('bne-view-bottom').emit('input');
 assert.equal(get('bne-view-height-value').textContent,'20.0 mm');assert.equal(get('bne-view-bottom-value').textContent,'15.0 mm');
 assert.equal(workers[0].messages.length,messageCount,'zoom must not change the experiment');
 get('bne-full-cell').emit('click');assert.equal(+get('bne-view-height').value,120);assert.equal(+get('bne-view-bottom').value,0);
 get('bne-fit-bed').emit('click');assert.ok(+get('bne-view-height').value<120);
 get('bne-mode').value='mixture';get('bne-mode').emit('input');
 assert.equal(get('bne-play').disabled,true);
 get('bne-reset').emit('click');assert.equal(workers[0].terminated,true);
 assert.equal(workers[1].messages[0].options.mode,'mixture');
 assert.equal(workers[1].messages[0].options.smallCount,1000);assert.equal(workers[1].messages[0].options.largeCount,600);assert.equal(workers[1].messages[0].options.initialization,'random');
 assert.equal(get('bne-contrast-control').hidden,true);assert.equal(get('bne-mixture-distribution').hidden,false);
 get('bne-open-setup').emit('click');assert.equal(get('bne-setup').open,true);
 get('bne-paper-sizes').emit('click');assert.equal(get('bne-small-min').value,'0.5');assert.equal(get('bne-large-max').value,'2.1');
 get('bne-close-setup').emit('click');
 get('bne-width').value='160';get('bne-height').value='200';get('bne-wall-friction').value='.2';get('bne-width').emit('input');get('bne-reset').emit('click');
 assert.equal(workers[2].messages[0].options.cellWidth,160);assert.equal(workers[2].messages[0].options.cellHeight,200);assert.equal(workers[2].messages[0].options.wallFriction,.2);
 workers[1]=workers[2];
 workers[1].emit({...data,options:{...bed.options,mode:'mixture'}});
 assert.equal(get('bne-large-count').disabled,false);
 get('bne-play').emit('click');
 workers[1].emit({...data,type:'done',commandId:workers[1].messages.at(-1).commandId,time:10,history:[{time:0,separation:0}]});
 assert.equal(get('bne-results').open,true);
 assert.ok(get('bne-chart').innerHTML.includes('<svg'));assert.ok(get('bne-chart').innerHTML.includes('Number-mean height'));
 get('bne-close-results').emit('click');assert.equal(get('bne-results').open,false);
 assert.equal(get('bne-open-results').focused,true);
 get('bne-open-results').emit('click');assert.equal(get('bne-results').open,true);
 get('bne-test-8').emit('click');
 assert.equal(get('bne-solver').value,'hertz');assert.equal(get('bne-restitution-control').hidden,true);
 assert.equal(get('bne-young').value,'63000');assert.equal(get('bne-width').value,'9');
 assert.equal(get('bne-count').value,'250');assert.equal(get('bne-large-count').value,'20');
 assert.equal(+get('bne-friction').value,Math.tan(25*Math.PI/180));
 // The old HTML controls were retired when Unity replaced this workbench.
 assert.equal(get('bne-frequency').value,'15');assert.equal(get('bne-amplitude').value,'1.5');
 get('bne-test-7').emit('click');assert.equal(get('bne-amplitude').value,'1');
});

test('worker acknowledges pause, cancels its pump and resumes from the frozen time',()=>{
 let now=0,nextTimer=0;const timers=new Map(),messages=[];
 class Bed{
  constructor(){this.time=0;this.options={duration:5};this.grains=[];this.initial={};}
  prepareStep(){return true;}
  nextDt(){return .01;}
  stats(){return {separation:0};}
  motion(){return {y:0};}
  step(dt){this.time+=dt;}
 }
 const sandbox={BNE:{BNEBed:Bed},importScripts(){},performance:{now:()=>now},postMessage:m=>messages.push(m),setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(require.resolve('./bne-worker.js'),'utf8'),sandbox);
 const send=data=>sandbox.onmessage({data});
 const tick=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);now+=100;fn();};
 send({type:'init',options:{}});assert.equal(messages.at(-1).type,'ready');
 send({type:'run',commandId:1,rate:1});tick();assert.ok(messages.at(-1).time>0);
 send({type:'pause',commandId:2});const paused=messages.at(-1);
 assert.equal(paused.type,'paused');assert.equal(paused.commandId,2);assert.equal(timers.size,0);
 now+=1000;send({type:'run',commandId:3,rate:1});
 assert.equal(messages.at(-1).time,paused.time);tick();
 assert.ok(messages.at(-1).time>paused.time);assert.equal(messages.at(-1).commandId,3);
});
