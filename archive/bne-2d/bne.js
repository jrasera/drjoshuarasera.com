(()=>{
 'use strict';
 const $=id=>document.getElementById(id),canvas=$('bne-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d'),dialog=$('bne-results'),play=$('bne-play');
 let worker=null,state=null,phase='preparing',seed=87413,dirty=false,lastAnnounced=-1,commandId=0,viewHeight=null,viewBottom=0;
 const inputs=['mode','solver','initialization','small-min','small-max','large-min','large-max','width','height','contrast','frequency','amplitude','duration','count','large-count','friction','wall-friction','restitution','density','young','poisson','normal-damping','shear-damping'];
 function options(){return {youngModulus:+$('bne-young').value*1e6,poisson:+$('bne-poisson').value,normalDamping:+$('bne-normal-damping').value,shearDamping:+$('bne-shear-damping').value,mode:$('bne-mode').value,solver:$('bne-solver').value,initialization:$('bne-initialization').value,smallMin:+$('bne-small-min').value,smallMax:+$('bne-small-max').value,largeMin:+$('bne-large-min').value,largeMax:+$('bne-large-max').value,cellWidth:+$('bne-width').value,cellHeight:+$('bne-height').value,wallFriction:+$('bne-wall-friction').value,ratio:+$('bne-contrast').value,frequency:+$('bne-frequency').value,amplitude:+$('bne-amplitude').value,duration:+$('bne-duration').value,smallCount:+$('bne-count').value,largeCount:+$('bne-large-count').value,friction:+$('bne-friction').value,restitution:+$('bne-restitution').value,densityRatio:+$('bne-density').value,seed};}
 function labels(){
  if($('bne-mode').value==='intruder')$('bne-large-count').value='1';
  for(const id of inputs){const out=$('bne-'+id+'-value');if(out)out.textContent=(['friction','wall-friction'].includes(id)?(+$('bne-'+id).value).toFixed(3):$('bne-'+id).value)+({width:' mm',height:' mm',contrast:'×',frequency:' Hz',amplitude:' mm',duration:' s'}[id]||'');}
  const o=options(),gamma=o.amplitude/1000*(2*Math.PI*o.frequency)**2/9.81;
  $('bne-motion-summary').textContent='Γ = '+gamma.toFixed(2)+' · full stroke '+(2*o.amplitude).toFixed(2)+' mm · Earth gravity';
  const mixture=o.mode==='mixture',hertz=o.solver==='hertz';
  $('bne-hertz-settings').hidden=!hertz;$('bne-restitution-control').hidden=hertz;
  $('bne-mixture-distribution').hidden=!mixture;$('bne-contrast-control').hidden=mixture;
  $('bne-sample-summary').textContent=mixture?o.smallCount+' small ('+o.smallMin+'–'+o.smallMax+' mm) + '+o.largeCount+' large ('+o.largeMin+'–'+o.largeMax+' mm)':'One intruder in '+o.smallCount+' small grains';
  $('bne-large-count').disabled=o.mode==='intruder'||phase==='running'||phase==='pausing'||phase==='preparing';
 }
 function lock(){
  for(const id of inputs)$('bne-'+id).disabled=phase==='running'||phase==='pausing'||phase==='preparing';
  $('bne-reset').disabled=phase==='running'||phase==='pausing'||phase==='preparing';
  $('bne-remix').disabled=phase==='preparing';
  $('bne-open-setup').disabled=phase==='running'||phase==='pausing'||phase==='preparing';
  play.disabled=phase==='pausing'||phase==='preparing'||phase==='error'||dirty;
  play.textContent=phase==='pausing'?'Pausing…':phase==='running'?'Pause Ⅱ':phase==='done'?'Prepare again ↻':phase==='paused'?'Resume ▶':'Shake the bed ▶';
  play.setAttribute('aria-pressed',String(phase==='running'));
  $('bne-open-results').disabled=!state?.initial||phase==='preparing';
  labels();
 }
 function prepare(remix=false){
  if($('bne-setup').open)$('bne-setup').close();
  if(remix)seed+=127;if(worker)worker.terminate();if(dialog.open)dialog.close();
  dirty=false;lastAnnounced=-1;commandId=0;viewHeight=null;viewBottom=0;phase='preparing';state=null;updateView();lock();paint();
  $('bne-note').textContent='Letting the new bed settle under gravity…';
  worker=new Worker('bne-worker.js');
  const activeWorker=worker;
  worker.onerror=()=>{phase='error';lock();$('bne-note').textContent='Could not load the DEM worker. Reload this page over HTTP or HTTPS.';};
  worker.onmessage=({data})=>{
   if(worker!==activeWorker)return;
   if(['frame','done','paused'].includes(data.type)&&(data.commandId!==commandId||(data.type!=='paused'&&phase!=='running')))return;
   if(data.type==='error'){phase='error';lock();$('bne-note').textContent=data.message;return;}
   state=data;
   if(data.type==='paused'){phase='paused';$('bne-note').textContent='Paused at '+data.time.toFixed(2)+' s.';if(dialog.open)results();}
   if(data.type==='ready'){fitBed();phase='ready';$('bne-note').textContent='Starting bed prepared. Choose Shake the bed to start. Particle motion is calculated, with no prescribed upward path.';}
   if(data.type==='done'){phase='done';$('bne-note').textContent='Shaking and 0.5 s of resting complete. Compare the initial and final beds.';results();dialog.showModal();}
   if(data.type==='preparing')$('bne-note').textContent='Settling the starting bed · '+data.settleTime.toFixed(1)+' s simulated';
   if(data.type==='frame'&&(Math.floor(data.time)!==lastAnnounced||(data.restTime??0)>0)){lastAnnounced=Math.floor(data.time);$('bne-note').textContent=((data.restTime??0)>0?'Resting '+data.restTime.toFixed(2)+' / 0.50 s · shaking complete.':'Simulated '+data.time.toFixed(2)+' / '+data.options.duration+' s · '+(data.time*data.options.frequency).toFixed(1)+' cycles. Playback may run slower on busy devices.');}
   // Leave controls untouched during frames: replacing button text between
   // pointer-down and pointer-up can cause the browser to discard a click.
   if(data.type!=='frame'&&data.type!=='preparing')lock();
   paint();
  };
  worker.postMessage({type:'init',options:options()});
 }
 function pauseSimulation(){
  if(phase!=='running')return;
  phase='pausing';worker.postMessage({type:'pause',commandId:++commandId});lock();
 }
 function updateView(){
  const height=state?state.options.cellHeight:options().cellHeight;
  viewHeight=Math.max(5,Math.min(height,viewHeight??height));
  viewBottom=Math.max(0,Math.min(height-viewHeight,viewBottom));
  $('bne-view-height').max=String(height);$('bne-view-height').value=String(viewHeight);
  $('bne-view-bottom').max=String(Math.max(0,height-viewHeight));$('bne-view-bottom').value=String(viewBottom);
  $('bne-view-bottom').disabled=height<=viewHeight;
  $('bne-view-height-value').textContent=viewHeight.toFixed(1)+' mm';
  $('bne-view-bottom-value').textContent=viewBottom.toFixed(1)+' mm';
 }
 function fitBed(){
  if(!state?.grains.length)return;
  let top=0;for(const p of state.grains)top=Math.max(top,p.y+p.r);
  viewBottom=0;viewHeight=Math.min(state.options.cellHeight,Math.max(5,top*1000*1.15+2*state.options.amplitude));
  updateView();
 }
 function paint(){
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const cw=(state?state.options.cellWidth:options().cellWidth)/1000,ch=(state?state.options.cellHeight:options().cellHeight)/1000;
  const visibleHeight=(viewHeight??ch*1000)/1000;
  const A=(state?state.options.amplitude:options().amplitude)/1000;
  const scale=Math.min((w-80)/cw,(h-80)/(visibleHeight+2*A)),left=(w-cw*scale)/2;
  const displacement=state?state.motion.y+(state.options.drive==='ramped'?0:A):A;
  const bottom=h-38-A*scale+viewBottom/1000*scale-displacement*scale;
  ctx.save();ctx.beginPath();ctx.rect(0,38,w,h-76);ctx.clip();
  ctx.fillStyle='#0a1c25';ctx.fillRect(left,bottom-ch*scale,cw*scale,ch*scale);
  ctx.strokeStyle='#8eb5c4';ctx.lineWidth=2;ctx.strokeRect(left,bottom-ch*scale,cw*scale,ch*scale);
  if(state)for(const p of state.grains){
   const x=left+p.x*scale,y=bottom-p.y*scale,r=p.r*scale;
   ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=p.large?'#e6ad84':'#92bdca';ctx.fill();
   ctx.strokeStyle=p.large?'#ffddc5':'#345563';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(p.angle)*r*.75,y-Math.sin(p.angle)*r*.75);ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle='#c4dce5';ctx.font='14px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText((cw*1000).toFixed(0)+' × '+(ch*1000).toFixed(0)+' mm · stroke '+(2*A*1000).toFixed(1)+' mm',w/2,23);
  $('bne-stage').textContent=phase==='preparing'?'PREPARING BED':state?state.time.toFixed(2)+' s / '+state.options.duration+' s':'READY';
  $('bne-live').textContent=state?.initial?'Large–small centre-height difference: '+(state.stats.separation*1000).toFixed(1)+' mm · vial '+(displacement*1000).toFixed(2)+' mm about midpoint':'Copper: large grains · blue: small grains';
 }
 function results(){
  if(!state?.initial)return;
  const a=state.initial,b=state.stats,delta=(b.separation-a.separation)*1000;
  $('bne-result-summary').textContent=(state.options.mode==='intruder'?'The intruder':'The large-grain centre of mass')+' moved '+Math.abs(delta).toFixed(1)+' mm '+(delta>=0?'up':'down')+' relative to the small-grain centre of mass.';
  $('bne-result-initial').textContent=(a.separation*1000).toFixed(1)+' mm';
  $('bne-result-final').textContent=(b.separation*1000).toFixed(1)+' mm';
  $('bne-result-change').textContent=(delta>=0?'+':'')+delta.toFixed(1)+' mm';
  $('bne-result-settings').textContent=state.time.toFixed(2)+' s · '+state.options.frequency+' Hz · '+state.options.amplitude+' mm peak amplitude · Γ '+b.gamma.toFixed(2)+' · '+state.grains.filter(p=>p.large).length+' large / '+state.grains.filter(p=>!p.large).length+' small grains · large-class mass '+(b.largeMassFraction*100).toFixed(1)+'% · '+(state.options.mode==='mixture'?'size classes '+state.options.smallMin+'–'+state.options.smallMax+' / '+state.options.largeMin+'–'+state.options.largeMax+' mm':'diameter ratio '+state.options.ratio+'×')+' · '+(state.options.initialization==='random'?'stochastic mixture':'large below small')+' · cell '+state.options.cellWidth+' × '+state.options.cellHeight+' mm · grain/wall friction '+state.options.friction+'/'+state.options.wallFriction+' · '+(state.options.solver==='hertz'?'Hertz–Mindlin · βn '+state.options.normalDamping+' / βs '+state.options.shearDamping+' · E '+(state.options.youngModulus/1e6)+' MPa · ':'')+(state.options.solver==='rigid'?'maximum pre-correction penetration ':'maximum contact overlap ')+(state.overlap*50).toFixed(1)+'% of the smaller diameter · step '+(state.dt*1e6).toFixed(1)+' µs';
  const n=b.numberSeparation??b.separation;
  $('bne-reference-result').hidden=state.options.mode!=='mixture';
  $('bne-reference-result').textContent='Number-mean height difference: '+(n*1000).toFixed(2)+' mm. Albino et al. report −0.4 mm for experimental test 7 and +4.1 mm for test 8; their 3D DEM test 8 is about +5.3 mm. This 2D model has not yet passed that validation. Large grains above ¼ / ½ / ¾ of the bed: '+(b.largeAbove||[]).map(v=>(v*100).toFixed(0)+'%').join(' / ')+'.';
  // Number-mean class heights allow a direct visual comparison with Fig. 9.
  const history=[{time:0,large:a.numberLarge,small:a.numberSmall},...state.history,{time:state.time,large:b.numberLarge,small:b.numberSmall}];
  const duration=Math.max(state.time,.1),valid=history.filter(p=>Number.isFinite(p.large)&&Number.isFinite(p.small));
  const hi=Math.max(1,...valid.flatMap(p=>[p.large*1000,p.small*1000]))*1.1,Y=v=>165-v/hi*135;
  const points=key=>valid.map(p=>(55+p.time/duration*590).toFixed(2)+','+Y(p[key]*1000).toFixed(2)).join(' ');
  $('bne-chart').innerHTML='<svg viewBox="0 0 700 220" role="img" aria-label="Number-mean heights of large and small grains in millimetres against shaking time"><path d="M55 25V165H645" fill="none" stroke="#74929f"/><polyline points="'+points('large')+'" fill="none" stroke="#e6ad84" stroke-width="2"/><polyline points="'+points('small')+'" fill="none" stroke="#92bdca" stroke-width="2"/><g fill="#d5e7ec" font-size="14"><text x="4" y="28">'+hi.toFixed(1)+'</text><text x="20" y="170">0</text><text x="55" y="190">0</text><text x="600" y="190">'+state.time.toFixed(1)+' s</text><text x="190" y="215">Number-mean height (mm) / shaking time (s)</text><text x="100" y="23" fill="#e6ad84">Large grains</text><text x="300" y="23" fill="#92bdca">Small grains</text></g></svg>';

 }
 play.addEventListener('click',()=>{
  if(phase==='done'){prepare();return;}
  if(phase==='running'){pauseSimulation();return;}
  if(play.disabled)return;
  if(state?.initial){phase='running';worker.postMessage({type:'run',commandId:++commandId,rate:+$('bne-playback').value});lock();}
 });
 $('bne-reset').addEventListener('click',()=>prepare());
 $('bne-remix').addEventListener('click',()=>prepare(true));
 $('bne-playback').addEventListener('change',()=>worker?.postMessage({type:'rate',rate:+$('bne-playback').value}));
 const savedSamples={},sampleFields=['solver','count','large-count','initialization','small-min','small-max','large-min','large-max'];let lastMode=$('bne-mode').value;
 function changed(){dirty=true;labels();play.disabled=true;$('bne-note').textContent='Settings changed. Choose Prepare bed to apply them.';}
 for(const id of inputs)$('bne-'+id).addEventListener('input',()=>{
  if(id==='mode'){
   savedSamples[lastMode]=Object.fromEntries(sampleFields.map(key=>[key,$('bne-'+key).value]));
   const fallback=$('bne-mode').value==='mixture'?{solver:'hertz',count:1000,'large-count':600,initialization:'random','small-min':.8,'small-max':1,'large-min':1.2,'large-max':1.4}:{solver:'hertz',count:160,'large-count':1,initialization:'layered','small-min':.8,'small-max':1,'large-min':1.2,'large-max':1.4};
   const values=savedSamples[$('bne-mode').value]||fallback;
   for(const [key,value]of Object.entries(values))$('bne-'+key).value=String(value);
   lastMode=$('bne-mode').value;
  }
  changed();
 });
 const setup=$('bne-setup');
 for(const condition of [7,8])$('bne-test-'+condition).addEventListener('click',()=>{
  $('bne-mode').value='mixture';lastMode='mixture';
  const preset={solver:'hertz',initialization:'random',count:250,'large-count':20,'small-min':.5,'small-max':.75,'large-min':1.7,'large-max':2.1,width:9,height:100,frequency:15,amplitude:condition===7?1:1.5,duration:10,friction:Math.tan(25*Math.PI/180),'wall-friction':Math.tan(25*Math.PI/180),density:1,young:63000,poisson:.16,'normal-damping':0,'shear-damping':0};
  for(const [key,value]of Object.entries(preset))$('bne-'+key).value=String(value);
  seed=87413;changed();
  $('bne-note').textContent='Test '+condition+' conditions loaded with your 20-large / 250-small 2D slice. Paper glass stiffness is slow; damping ratios default to zero and are adjustable.';
 });
 $('bne-open-setup').addEventListener('click',()=>setup.showModal());
 $('bne-close-setup').addEventListener('click',()=>setup.close());
 setup.addEventListener('close',()=>$('bne-open-setup').focus());
 $('bne-apply-setup').addEventListener('click',()=>prepare());
 $('bne-paper-sizes').addEventListener('click',()=>{
  for(const [key,value]of Object.entries({'small-min':.5,'small-max':.75,'large-min':1.7,'large-max':2.1}))$('bne-'+key).value=String(value);
  changed();
 });
 $('bne-open-results').addEventListener('click',()=>{pauseSimulation();results();dialog.showModal();});
 $('bne-close-results').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>$('bne-open-results').focus());
 dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseSimulation();});
 $('bne-fit-bed').addEventListener('click',()=>{fitBed();paint();});
 $('bne-full-cell').addEventListener('click',()=>{viewHeight=state?state.options.cellHeight:options().cellHeight;viewBottom=0;updateView();paint();});
 $('bne-view-height').addEventListener('input',()=>{viewHeight=+$('bne-view-height').value;updateView();paint();});
 $('bne-view-bottom').addEventListener('input',()=>{viewBottom=+$('bne-view-bottom').value;updateView();paint();});
 window.addEventListener('resize',paint);prepare();updateView();
})();
