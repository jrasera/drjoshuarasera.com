/* Outreach interface: trajectories are calculated once, then played back in physical time. */
(() => {
 'use strict';
 const canvas=document.querySelector('#separator');if(!canvas)return;
 const E=window.Electrostatics,C=window.CollectorBed,ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
 const controls={voltage:$('electro-voltage'),charging:$('electro-charging'),diameter:$('electro-diameter'),air:$('electro-air'),gravity:$('electro-gravity'),variation:$('electro-variation')};
 const run=$('run'),finish=$('electro-finish'),product=$('electro-product'),forces={checked:false},speed=$('electro-speed');
 const resultsDialog=$('electro-results-dialog'),resultsButton=$('electro-open-results');
 function openResults(){if(complete&&!resultsDialog.open)resultsDialog.showModal();}
 resultsButton.addEventListener('click',openResults);
 $('electro-close-results').addEventListener('click',()=>resultsDialog.close());
 resultsDialog.addEventListener('close',()=>resultsButton.focus());
 resultsDialog.addEventListener('click',event=>{
  const r=resultsDialog.getBoundingClientRect();
  if(event.target===resultsDialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))resultsDialog.close();
 });
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let reverse=false,batch=null,previousBatch=null,time=0,running=false,complete=false,w=0,h=0,raf=0,lastFrame=0,lastReadout=0,pending=0;
 let settlement=null,endTime=0,trackedIndex=null,stoppedAtTracked=false,hits=[];
 let batchSpeed='0.25';
 const destinations=[['left','Left collector'],['centre','Centre collector'],['right','Right collector'],['leftPlate','Left electrode'],['rightPlate','Right electrode'],['missed','Outside collectors']];
 const rows={};
 for(const [key,label] of destinations){
  const row=document.createElement('tr');row.innerHTML='<th scope="row"></th><td>0</td><td>0</td><td>—</td><td>—</td><td>—</td><td>—</td>';row.cells[0].textContent=label;
  $('electro-bin-results').append(row);rows[key]=row;
 }
 const grainSelect=$('electro-grain');
 const forceRows=[['electric','Electrostatic qE'],['drag','Air drag (x and y)'],['weight','Weight mg'],['buoyancy','Buoyancy'],['net','Net force']];
 const forceCells={};
 for(const [key,label]of forceRows){
  const row=document.createElement('tr');row.dataset.force=key;row.innerHTML='<th scope="row"></th><td>—</td><td>—</td>';row.cells[0].textContent=label;
  $('electro-force-values').append(row);forceCells[key]=row;
 }
 const percent=n=>n===null?'Empty':(n*100).toFixed(1)+'%';
 function options(){return {voltage:+controls.voltage.value,charging:+controls.charging.value,diameter:+controls.diameter.value,air:controls.air.value==='air',gravity:+controls.gravity.value,variation:controls.variation.checked,reverse};}
 function syncLabels(){
  const o=options();$('electro-voltage-value').textContent=o.voltage+' kV';$('electro-charging-value').textContent=o.charging+'%';$('electro-diameter-value').textContent=o.diameter+' µm';
  $('electro-reverse').setAttribute('aria-pressed',String(reverse));
  $('electro-field-reading').textContent='Field: '+Math.round(Math.abs(E.electricField(o))/1000)+' kV/m · '+(o.voltage===0?'off':reverse?'points right →':'points left ←');
  const ratio=o.charging/100*(200/o.diameter)**2;
  $('electro-charge-reading').textContent='Nominal q/m at selected diameter: ilmenite +'+(2.2*ratio).toFixed(2)+' · silica '+(-5*ratio).toFixed(2)+' µC/kg. Charge scales with diameter (q ∝ d).';
 }
 function pause(){running=false;lastFrame=0;cancelAnimationFrame(raf);run.textContent=complete?'Run again ↻':time>0?'Resume ▶':reduced?'Show the experiment result':'Release 120 grains ▶';run.setAttribute('aria-pressed','false');}
 function buildSettlement(){
  const rect=canvas.getBoundingClientRect(),zoom=(rect.width-64)/C.WIDTH;
  const verticalScale=(rect.height-C.DEPTH*zoom-136)/E.GEOMETRY.collectorY/zoom;
  settlement=C.build(batch,{verticalScale});endTime=Math.max(batch.duration,settlement.duration);
 }
 function prepare(){
  if(resultsDialog.open)resultsDialog.close();resultsButton.disabled=true;
  clearTimeout(pending);pending=0;pause();
  if(complete&&batch)previousBatch=batch;
  batch=E.makeBatch(options());buildSettlement();refreshGrains();time=0;complete=false;stoppedAtTracked=false;
  run.textContent=reduced?'Show the experiment result':'Release 120 grains ▶';finish.disabled=false;
  syncLabels();readouts();
  $('electro-status').textContent='Ready. Predict what will happen, then release the same 120-grain sample.';
  draw();
 }
 function explanation(r){

  if(batch.options.charging===0)return 'Without charge, the electric field has no force to act on. Both minerals fall into the centre. Choose the centre collector to see that its purity stays at the feed grade.';
  if(batch.options.voltage===0)return 'The grains carry charge, but there is no electric field to deflect them. They fall together into the centre.';
  if(r.grade===null)return 'This collector is empty. Choose another product collector or change the settings.';
  const direction=r.grade>r.feedGrade+.005?'enriched in ilmenite':r.grade<r.feedGrade-.005?'depleted in ilmenite':'similar in composition to the feed';
  return 'Your '+product.options[product.selectedIndex].text.toLowerCase()+' is '+direction+'. It contains '+percent(r.grade)+' ilmenite and recovers '+percent(r.recovery)+' of the starting ilmenite. '+(r.plateLoss>.02?'Some feed hits the plates instead of becoming product. Stronger deflection can therefore cost useful recovery.':'Purity tells you what your product contains; recovery tells you how much of the wanted mineral you kept.');
 }
 function readouts(){
  if(!batch)return;const r=E.results(batch,time,product.value);
  $('electro-feed-grade').textContent=percent(r.feedGrade);
  $('electro-grade').textContent=complete?percent(r.grade):'—';
  $('electro-recovery').textContent=complete?percent(r.recovery):'—';
  $('electro-loss').textContent=complete?percent(r.plateLoss):'—';
  for(const [key]of destinations){const row=rows[key];row.cells[1].textContent=r.bins[key].counts[0];row.cells[2].textContent=r.bins[key].counts[1];for(let mineral=0;mineral<2;mineral++){row.cells[3+mineral*2].textContent=complete?percent(r.bins[key].grade[mineral]):'—';row.cells[4+mineral*2].textContent=complete?percent(r.bins[key].recovery[mineral]):'—';}row.dataset.product=String(key===product.value);}
  $('electro-table-caption').textContent='Grains accounted for — '+r.collected+' / 120. Grades and recoveries use mass. Grade: mineral share of each cut; recovery: share of that mineral in the feed.';
  $('electro-explanation').textContent=complete?explanation(r):'Run the experiment to compare your product with the feed. Settings are fixed for each run.';
  $('electro-clock').textContent=complete?'120 grains accounted for':time>0?time.toFixed(2)+' s simulated · '+r.collected+' / 120 collected':'Ready to release';
  const comparison=$('electro-comparison');comparison.hidden=!(complete&&previousBatch);
  if(!comparison.hidden){
   const prior=E.results(previousBatch,Infinity,product.value),delta=r.recovery-prior.recovery;
   comparison.textContent='Previous completed run, same collector: '+(prior.grade===null?'empty collector':percent(prior.grade)+' purity')+'; '+percent(prior.recovery)+' recovery; '+percent(prior.plateLoss)+' on plates. Recovery changed by '+(delta>=0?'+':'')+(delta*100).toFixed(1)+' percentage points.';
  }
 }
 function finishRun(){
  clearTimeout(pending);if(pending)prepare();
  time=endTime;complete=true;pause();finish.disabled=true;readouts();draw();
  $('electro-status').textContent='Run complete. View the grades and recoveries for each cut.';
  resultsButton.disabled=false;openResults();
 }
 function frame(stamp){
  if(!running)return;
  let next=time;
  if(lastFrame)next=Math.min(endTime,time+Math.min((stamp-lastFrame)/1000,.1)*Number(speed.value));
  lastFrame=stamp;
  const p=tracked(),impact=p.release+p.duration;
  if(forces.checked&&!stoppedAtTracked&&time<impact&&next>=impact){
   time=impact-1e-7;stoppedAtTracked=true;pause();readouts();draw();
   $('electro-status').textContent='Paused just before grain #'+(trackedIndex+1)+' reaches '+(p.destination.endsWith('Plate')?'an electrode':'its destination')+'. Inspect the forces or resume to watch collection.';return;
  }
  time=next;
  if(time>=endTime){finishRun();return;}
  draw();if(stamp-lastReadout>120){readouts();lastReadout=stamp;}raf=requestAnimationFrame(frame);
 }
 function start(){
  if(pending)prepare();
  if(running){pause();$('electro-status').textContent='Paused. Resume to keep watching, or show the result.';readouts();return;}
  if(complete)prepare();
  if(reduced){finishRun();return;}
  running=true;lastFrame=0;run.textContent='Pause Ⅱ';run.setAttribute('aria-pressed','true');
  $('electro-status').textContent='Watch the grains fall. Positive and negative charges feel electric forces in opposite directions.';
  raf=requestAnimationFrame(frame);
 }
 function settingsChanged(){
  pause();syncLabels();
  // Clear stale results immediately; debounce only the new calculation.
  complete=false;time=0;resultsButton.disabled=true;if(resultsDialog.open)resultsDialog.close();
  // Retain the most recent finished run before discarding the trajectories.
  if(batch&&batch.finishedForComparison)previousBatch=batch;
  $('electro-status').textContent='Settings changed. Preparing the same starting sample…';
  clearTimeout(pending);pending=setTimeout(prepare,100);
 }
 function rememberFinished(){if(complete&&batch){previousBatch=batch;batch.finishedForComparison=true;}}
 for(const control of Object.values(controls))control.addEventListener('input',()=>{rememberFinished();settingsChanged();});
 $('electro-reverse').addEventListener('click',()=>{rememberFinished();reverse=!reverse;settingsChanged();});
 run.addEventListener('click',start);finish.addEventListener('click',finishRun);$('electro-replay').addEventListener('click',prepare);
 product.addEventListener('change',()=>{readouts();draw();if(complete)$('electro-status').textContent=explanation(E.results(batch,time,product.value));});
 function syncPanel(){
  const active=forces.checked;
  $('electro-settings').hidden=active;$('electro-inspection').hidden=!active;
  $('electro-sidebar').dataset.mode=active?'inspect':'experiment';
  for(const [id,selected]of [['electro-tab-experiment',!active],['electro-tab-inspect',active]]){
   $(id).setAttribute('aria-selected',String(selected));$(id).tabIndex=selected?0:-1;
  }
  $('electro-select-grain').setAttribute('aria-expanded',String(active));
  $('electro-select-grain').textContent=active?'Choose another grain ↗':'Select a grain to see its forces ↗';
  $('electro-select-hint').textContent=active?'The white ring marks your grain. Click another grain or use the selector alongside the animation.':'Click a grain in the separator, or choose “Inspect a grain”. The animation pauses so you can look closely.';
 }
 function revealInspector(){
  if(matchMedia('(max-width: 900px)').matches)$('electro-sidebar').scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
 }
 function openInspection(){
  if(forces.checked){grainSelect.focus({preventScroll:true});revealInspector();return;}
  batchSpeed=speed.value;forces.checked=true;selectInspection();revealInspector();
 }
 function closeInspection(){
  forces.checked=false;speed.value=batchSpeed;selectInspection(false);
 }
 $('electro-select-grain').addEventListener('click',openInspection);
 $('electro-tab-inspect').addEventListener('click',openInspection);
 $('electro-tab-experiment').addEventListener('click',closeInspection);
 for(const id of ['electro-tab-experiment','electro-tab-inspect'])$(id).addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?'electro-tab-experiment':event.key==='End'?'electro-tab-inspect':id==='electro-tab-experiment'?'electro-tab-inspect':'electro-tab-experiment';
  if(next==='electro-tab-inspect')openInspection();else closeInspection();
  $(next).focus({preventScroll:true});
 });

 grainSelect.addEventListener('change',()=>{trackedIndex=Number(grainSelect.value);stoppedAtTracked=false;seekField();});
 $('electro-flight-progress').addEventListener('input',event=>seekFlight(Number(event.target.value)/1000));
 $('electro-step').addEventListener('click',()=>{const p=tracked();seekFlight((Math.max(0,time-p.release)+.005)/p.duration);});
 $('electro-step-back').addEventListener('click',()=>{const p=tracked();seekFlight((time-p.release-.005)/p.duration);});
 $('electro-seek-field').addEventListener('click',seekField);
 $('electro-play-grain').addEventListener('click',()=>{speed.value='0.02';seekFlight(0);start();});
 canvas.addEventListener('pointerdown',event=>{
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const hit=hits.map(v=>({...v,distance:Math.hypot(v.x-x,v.y-y)})).sort((a,b)=>a.distance-b.distance)[0];
  if(hit&&hit.distance<22){trackedIndex=hit.index;grainSelect.value=trackedIndex;if(!forces.checked)batchSpeed=speed.value;forces.checked=true;stoppedAtTracked=false;selectInspection(false);revealInspector();}
 });
 document.querySelectorAll('[data-experiment]').forEach(button=>button.addEventListener('click',()=>{
  rememberFinished();const task=button.dataset.experiment;
  if(task==='default'||task==='no-charge'){
   for(const key of ['voltage','charging','diameter','gravity'])controls[key].value=E.DEFAULTS[key];
   controls.air.value='air';controls.variation.checked=true;reverse=false;
   if(task==='default'){product.value='left';forces.checked=false;speed.value='0.25';}
   if(task==='no-charge')controls.charging.value=0;
  }
  if(task==='reverse')reverse=!reverse;
  if(task==='strong')controls.voltage.value=50;
  $('electro-question').textContent=task==='no-charge'?'Predict: can a strong electric field sort grains with no charge?':task==='reverse'?'Predict: which collector will receive most of the ilmenite now?':task==='strong'?'Predict: will stronger voltage improve recovery, or send more grains into the plates?':'Make a prediction: will stronger voltage always give you a better separation?';
  prepare();
 }));
 function tracked(){return batch.particles[trackedIndex];}
 function refreshGrains(){
  const prior=trackedIndex;
  grainSelect.replaceChildren();
  batch.particles.forEach((p,i)=>{
   const option=document.createElement('option');option.value=i;
   option.textContent='#'+(i+1)+' · '+(p.kind===0?'Ilmenite':'Silica')+' · '+(p.chargeMass>0?'+':p.chargeMass<0?'−':'uncharged');
   grainSelect.append(option);
  });
  trackedIndex=prior===null?Math.max(0,batch.particles.findIndex(p=>p.kind===0&&p.chargeMass>0)):Math.min(prior,batch.particles.length-1);
  grainSelect.value=trackedIndex;
 }
 function seekFlight(fraction){
  if(pending)prepare();
  const p=tracked();time=p.release+p.duration*Math.max(0,Math.min(1-1e-7,fraction));
  complete=false;finish.disabled=false;stoppedAtTracked=false;pause();readouts();draw();
  $('electro-status').textContent='Paused on grain #'+(trackedIndex+1)+'. Scrub its flight or advance in 5 ms steps.';
 }
 function seekField(){
  const p=tracked(),target=Math.min(.25,p.final[1]*.75);
  const point=p.path.find(s=>s.state[1]>=target)||p.path[Math.floor(p.path.length/2)];
  seekFlight(point.t/p.duration);
 }
 function selectInspection(jump=true){
  if(pending)prepare();
  pause();syncPanel();
  if(forces.checked){speed.value='0.02';if(jump)seekField();else{readouts();draw();}}
  else draw();
 }
 function forceNumber(n){
  const value=n*1e9;if(Math.abs(value)<1e-8)return '0';
  return (value>0?'+':'−')+Math.abs(value).toFixed(Math.abs(value)<.1?3:2);
 }
 function inspect(){
  syncPanel();
  if(!forces.checked||!batch)return;
  const p=tracked(),elapsed=time-p.release,arrived=elapsed>=p.duration;
  const t=Math.max(0,Math.min(p.duration-1e-7,elapsed));
  const sample=E.sample(p,p.release+t),state=sample.state,F=E.forceComponents(p,state,batch.options);
  const inField=state[1]>=E.GEOMETRY.fieldTop&&state[1]<E.GEOMETRY.fieldBottom;
  const phase=elapsed<0?'Waiting at the inlet':arrived?'Flight ended — scrub back to inspect the flight forces':inField?'Between the electrodes':'Outside the electrode region';
  $('electro-flight-progress').value=Math.round(t/p.duration*1000);
  $('electro-flight-value').textContent=(100*t/p.duration).toFixed(1)+'%';
  $('electro-grain-state').textContent='Grain #'+(trackedIndex+1)+' · '+E.MATERIALS[p.kind].name+' · '+phase+' · t '+t.toFixed(3)+' s.';
  $('electro-grain-properties').textContent='Charge '+(p.chargeMass*p.mass*1e15).toFixed(1)+' fC; diameter '+(p.diameter*1e6).toFixed(0)+' µm; charge-to-mass ratio '+(p.chargeMass*1e6).toFixed(2)+' µC/kg.';
  for(const [key]of forceRows){
   const row=forceCells[key];row.cells[1].textContent=arrived?'—':forceNumber(F[key].x);row.cells[2].textContent=arrived?'—':forceNumber(F[key].y);
  }
  $('electro-force-explanation').textContent=arrived?'Contact forces during collection are not included in this free-flight diagram. Drag and electric forces above are blank until you scrub back into the flight.':(!inField?'Electrostatic force is zero here: this idealised model applies the field only between the plate ends. ':p.chargeMass===0?'Electrostatic force is zero because this grain has no charge. ':batch.options.voltage===0?'Electrostatic force is zero because the voltage is off. ':'The electric field is horizontal, so electrostatic force has an x component and no y component. ')+(batch.options.air?'Air drag opposes motion in both x and y.':'In vacuum, both components of air drag and buoyancy are zero.');
  const c=$('electro-force-diagram'),r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),cw=r.width,ch=280;
  if(!cw)return;c.width=Math.round(cw*dpr);c.height=ch*dpr;
  const d=c.getContext('2d');d.setTransform(dpr,0,0,dpr,0,0);d.clearRect(0,0,cw,ch);
  const cx=cw/2,cy=ch/2+10;
  if(!p.forceMaximum){
   p.forceMaximum=Math.max(...p.path.flatMap(point=>{const f=E.forceComponents(p,point.state,batch.options);return [f.weight.y,Math.abs(f.electric.x),Math.abs(f.drag.x),Math.abs(f.drag.y),Math.abs(f.buoyancy.y)];}));
  }
  const scale=85/Math.max(1e-15,p.forceMaximum);
  function vector(dx,dy,colour,label){
   dx*=scale;dy*=scale;if(Math.hypot(dx,dy)<1)return;
   const angle=Math.atan2(dy,dx);d.strokeStyle=colour;d.fillStyle=colour;d.lineWidth=3;
   d.beginPath();d.moveTo(cx,cy);d.lineTo(cx+dx,cy+dy);d.stroke();
   d.beginPath();d.moveTo(cx+dx,cy+dy);d.lineTo(cx+dx-9*Math.cos(angle-.4),cy+dy-9*Math.sin(angle-.4));d.lineTo(cx+dx-9*Math.cos(angle+.4),cy+dy-9*Math.sin(angle+.4));d.closePath();d.fill();
   d.font='14px "DM Sans",sans-serif';d.textAlign=dx<0?'right':'left';
   const lx=Math.max(90,Math.min(cw-90,cx+dx+(dx<0?-10:10))),ly=cy+dy+(dy<0?-9:19);
   d.fillText(label,lx,Math.max(32,Math.min(ch-18,ly)));
  }
  d.strokeStyle='#365361';d.lineWidth=1;d.setLineDash([3,5]);d.beginPath();d.moveTo(18,cy);d.lineTo(cw-18,cy);d.moveTo(cx,30);d.lineTo(cx,ch-20);d.stroke();d.setLineDash([]);
  d.font='14px "DM Sans",sans-serif';d.textAlign='center';d.fillStyle='#d3e6eb';d.fillText('GRAIN #'+(trackedIndex+1)+' · ENLARGED FORCE VIEW',cx,20);
  if(!arrived){
   vector(F.electric.x,0,'#f5a9d1','qE');
   vector(F.drag.x,0,'#91cce8','drag x');
   vector(0,F.drag.y,'#a2e1d6','drag y');
   vector(0,F.weight.y,'#d9e4a3','weight');
   vector(0,F.buoyancy.y,'#c8b8f4','buoyancy');
  }
  d.fillStyle=E.MATERIALS[p.kind].colour;d.beginPath();
  if(p.kind===0){d.moveTo(cx,cy-15);d.lineTo(cx+15,cy);d.lineTo(cx,cy+15);d.lineTo(cx-15,cy);d.closePath();}else d.arc(cx,cy,15,0,Math.PI*2);
  d.fill();d.fillStyle='#0b1b24';d.font='bold 18px "DM Sans",sans-serif';d.textAlign='center';d.fillText(p.chargeMass>0?'+':p.chargeMass<0?'−':'0',cx,cy+6);
 }
 function arrow(x,y,dx,dy,colour,label){
  if(Math.hypot(dx,dy)<.4)return;const angle=Math.atan2(dy,dx);
  ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-7*Math.cos(angle-.45),y+dy-7*Math.sin(angle-.45));ctx.lineTo(x+dx-7*Math.cos(angle+.45),y+dy-7*Math.sin(angle+.45));ctx.closePath();ctx.fill();
  if(label){ctx.font='13px "DM Sans",sans-serif';ctx.textAlign='left';ctx.fillText(label,Math.max(8,Math.min(w-65,x+dx+7)),Math.max(20,Math.min(h-10,y+dy+4)));}
 }
 function symbol(p,x,y,r=4,sign=false){
  ctx.fillStyle=E.MATERIALS[p.kind].colour;ctx.beginPath();
  if(p.kind===0){ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();}
  else ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  if(sign&&Math.abs(p.chargeMass)>1e-12){ctx.fillStyle='#edf5f5';ctx.font='12px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText(p.chargeMass>0?'+':'−',x,y-r-4);}
 }
 function draw(){
  if(!batch||!w)return;
  const G=E.GEOMETRY,o=batch.options,zoom=(w-64)/C.WIDTH;
  ctx.clearRect(0,0,w,h);
  const bedDepth=C.DEPTH*zoom,top=72,bottom=h-bedDepth-64,sy=(bottom-top)/G.collectorY,sx=(w-64)/.28,cx=w/2;
  const X=x=>cx+x*sx,Y=y=>top+y*sy,left=X(-G.gap/2),right=X(G.gap/2),a=Y(G.fieldTop),b=Y(G.fieldBottom);
  ctx.fillStyle='#122a37';ctx.fillRect(left,a,right-left,b-a);
  ctx.font='14px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillStyle='#c4dce5';ctx.fillText('From the charger',cx,24);
  ctx.strokeStyle='#7996a5';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(cx-25,35);ctx.lineTo(cx-7,58);ctx.lineTo(cx+7,58);ctx.lineTo(cx+25,35);ctx.stroke();
  ctx.fillStyle='#adc6d1';ctx.font='12px "DM Sans",sans-serif';ctx.fillText('150 mm between plates',cx,a+24);
  for(let y=a+65;y<b-15;y+=65)if(o.voltage){const dx=(o.reverse?1:-1)*Math.min(65,(right-left)*.25);arrow(cx-dx/2,y,dx,0,'#436677','');}
  ctx.fillStyle='#9ab1bd';ctx.fillRect(left-3,a,6,b-a);ctx.fillRect(right-3,a,6,b-a);
  ctx.font='16px "DM Sans",sans-serif';ctx.fillStyle='#e1edf0';
  ctx.fillText((o.voltage?o.reverse?'+':'−':'0')+(o.voltage?' '+o.voltage/2+' kV':''),left,a-15);
  ctx.fillText((o.voltage?o.reverse?'−':'+':'0')+(o.voltage?' '+o.voltage/2+' kV':''),right,a-15);
  const cuts=[-.12,-G.cut,G.cut,.12],keys=['left','centre','right'];
  for(let i=0;i<3;i++){
   const xl=X(cuts[i]),xr=X(cuts[i+1]);ctx.fillStyle=keys[i]===product.value?'#294b5b':'#162e3d';ctx.fillRect(xl,bottom,xr-xl,bedDepth);
   ctx.strokeStyle=keys[i]===product.value?'#b7e1e8':'#607e8e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(xl,bottom);ctx.lineTo(xl,bottom+bedDepth);ctx.lineTo(xr,bottom+bedDepth);ctx.lineTo(xr,bottom);ctx.stroke();
   ctx.fillStyle='#d0e4eb';ctx.font='14px "DM Sans",sans-serif';ctx.textAlign='center';ctx.fillText(['Left','Centre','Right'][i],(xl+xr)/2,bottom+bedDepth+25);
  }
  hits=[];let selected=null;
  for(let index=0;index<batch.particles.length;index++){
   const p=batch.particles[index],s=E.sample(p,time);if(!s)continue;
   const chosen=forces.checked&&index===trackedIndex;
   ctx.globalAlpha=forces.checked&&!chosen ? 0.20 : 1;
   if((chosen||!forces.checked&&index%5===0)&&time>p.release){
    ctx.strokeStyle=chosen?'#f2f7f8':p.kind===0?'#e6ad8438':'#8ed0df38';ctx.lineWidth=chosen?2.2:1;ctx.beginPath();
    let first=true;for(const point of p.path){if(point.t>time-p.release)break;const x=X(point.state[0]),y=Y(point.state[1]);if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);}ctx.stroke();
   }
   let x=X(s.state[0]),y=Y(s.state[1]),radius=4.2*p.diameter/(o.diameter*1e-6)*zoom,visible=true;
   if(s.done){
    const bed=C.sample(settlement,index,time);
    if(bed){x=32+bed.x*zoom;y=bottom+bed.y*zoom;radius=bed.r*zoom;}
    else if(p.destination==='missed')visible=false;
   }
   if(visible){
    symbol(p,x,y,Math.max(1.8,radius),!s.done&&!forces.checked);
    hits.push({index,x,y});
    if(chosen)selected={p,x,y,radius};
   }
  }
  ctx.globalAlpha=1;
  if(selected){
   const {p,x,y,radius}=selected;symbol(p,x,y,Math.max(3,radius),false);
   ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,Math.max(10,radius+5),0,Math.PI*2);ctx.stroke();
   ctx.font='bold 14px "DM Sans",sans-serif';ctx.textAlign='left';ctx.fillStyle='#fff';ctx.fillText('#'+(trackedIndex+1),Math.min(w-45,x+15),Math.max(20,y-12));
  }
  if(time===0)for(let i=0;i<8;i++)symbol({kind:i%2},cx+(i%4-1.5)*10,40+Math.floor(i/4)*8,3);
  $('electro-scale').textContent='Flight horizontal distances ×'+(sx/sy).toFixed(1)+'. Collector grains enlarged and rescaled; contact settling is illustrative.'+(forces.checked?' Following grain #'+(trackedIndex+1)+' throughout.':' Click a grain to inspect it.');
  inspect();
 }
 function resize(){
  const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;
  if(batch)buildSettlement();
  const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){pause();readouts();$('electro-status').textContent='Paused while this page was hidden. Resume when you are ready.';}});
 window.addEventListener('resize',resize);
 prepare();resize();
 if(forces.checked)selectInspection();
})();
