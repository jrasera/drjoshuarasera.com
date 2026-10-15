(() => {
 const canvas=document.querySelector('#bne-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d'),contrastInput=document.querySelector('#bne-contrast'),cycleInput=document.querySelector('#bne-cycle'),play=document.querySelector('#bne-play');
 const frequencyInput=document.querySelector('#bne-frequency'),amplitudeInput=document.querySelector('#bne-amplitude'),playbackInput=document.querySelector('#bne-playback');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let model,w=0,h=0,playing=false,seeking=false,seekTarget=0,raf=0,lastTime=0,seed=87413;
 function readouts(){
  if(!model)return;const cycle=model.cycle,ratio=model.ratio,off=model.cycleRate===0;
  contrastInput.value=ratio;cycleInput.value=seeking?seekTarget:Math.floor(cycle+1e-7);
  frequencyInput.value=model.frequency;amplitudeInput.value=model.amplitude;playbackInput.value=Math.round(1/model.playbackRate);
  document.querySelector('#bne-contrast-value').textContent=ratio.toFixed(1)+'×';document.querySelector('#bne-cycle-value').textContent=Math.floor(cycle+1e-7)+' / 16';
  document.querySelector('#bne-frequency-value').textContent=model.frequency+' Hz';document.querySelector('#bne-amplitude-value').textContent=model.amplitude.toFixed(2)+' mm';
  document.querySelector('#bne-motion-summary').textContent='Full stroke: '+(2*model.amplitude).toFixed(2)+' mm. Playback: 1/'+Math.round(1/model.playbackRate)+' real time.';
  play.disabled=off;
  if(off){play.textContent='Vibration off';play.setAttribute('aria-pressed','false')}
  else if(!playing)play.textContent='Shake the bed ▶';
  let stage='CYCLE '+Math.floor(cycle);
  if(seeking)stage='PREVIEWING A STAGE';else if(off)stage='VIBRATION OFF';else if(cycle===0)stage='MIXED BED';else if(cycle>=16)stage='AFTER REPEATED REARRANGEMENT';else if(playing)stage=['OPEN GAPS','FINES SETTLE','BED REARRANGES'][Math.min(2,Math.floor((cycle%1)*3))];
  document.querySelector('#bne-stage').textContent=stage;
  document.querySelector('#bne-note').textContent=off?'With frequency or amplitude set to zero, playback holds the bed still. The cycle slider can still preview the guided stages.':ratio===1?'With equal grain sizes, this illustration has no size-driven upward migration. Colour alone does not create the effect.':cycle===0?'Choose the frequency and peak amplitude, then watch the whole bed move with the container in slow motion.':cycle>=16?'The guided sequence is complete. Compare with the initial mixture or remix to explore the mechanism again.':'Fine grains settle beneath the larger grains. The entire container and bed share the imposed vibration; playback is slowed by the selected factor.';
 }
 function paint(){
  if(!model)return;ctx.clearRect(0,0,w,h);
  const {left,right,top,bottom,grains,large}=model;
  ctx.save();ctx.translate(0,model.containerShift);
  ctx.fillStyle='#0e1b23';ctx.fillRect(left,top,right-left,bottom-top);
  ctx.strokeStyle='#678696';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,bottom);ctx.lineTo(right,bottom);ctx.lineTo(right,top);ctx.stroke();
  for(const a of grains){ctx.fillStyle='#a9bcc6';ctx.beginPath();ctx.arc(a.x,a.y,a.rad,0,Math.PI*2);ctx.fill()}
  for(let i=0;i<large.length;i++){const a=large[i];ctx.fillStyle=i?'#82c4cf':'#d9a47d';ctx.beginPath();ctx.arc(a.x,a.y,a.rad,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e4edf0';ctx.lineWidth=.65;ctx.stroke()}
  if(playing&&model.ratio>1&&model.cycle<16){ctx.strokeStyle='#b4d8e1';ctx.lineWidth=1.2;for(const a of large){const x=a.x+a.rad+9,y=a.y+a.rad*.15;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+18);ctx.lineTo(x-3,y+13);ctx.moveTo(x,y+18);ctx.lineTo(x+3,y+13);ctx.stroke()}}
  ctx.restore();ctx.textAlign='center';ctx.font='9px monospace';ctx.fillStyle='#b9d4df';ctx.fillText('GUIDED VOID-FILLING MECHANISM',w/2,26);
  ctx.fillStyle='#9db7c4';ctx.fillText(playing?'↑ VIBRATION / SLOW MOTION ↓':'MIXED GRAINS / REARRANGE / COMPARE',w/2,h-17);ctx.textAlign='left';
 }
 function stop(){playing=false;seeking=false;lastTime=0;cancelAnimationFrame(raf);play.setAttribute('aria-pressed','false');play.textContent='Shake the bed ▶';readouts();paint()}
 function frame(time){if(!playing)return;if(lastTime)model.advance((time-lastTime)/1000);lastTime=time;readouts();paint();if(model.cycle>=16)stop();else raf=requestAnimationFrame(frame)}
 function setCycle(value){
  stop();seekTarget=Math.max(0,Math.min(16,value));if(seekTarget<model.cycle-1e-8)model.reset(model.ratio,seed);seeking=true;
  const previewRate=Math.max(model.cycleRate,1);
  function arrange(){
   if(!seeking)return;const started=performance.now();
   while(model.cycle<seekTarget-1e-8&&performance.now()-started<7)model.integrate(Math.min(model.fixedDt,(seekTarget-model.cycle)/previewRate),true,previewRate);
   if(model.cycle>=seekTarget-1e-8){model.cycle=seekTarget;model.accumulator=0;model.updateLarge();model.project();seeking=false}
   readouts();paint();if(seeking)raf=requestAnimationFrame(arrange);
  }
  readouts();raf=requestAnimationFrame(arrange);
 }
 function resize(){
  const target=model?Math.floor(model.cycle):0,ratio=model?model.ratio:3,frequency=model?model.frequency:30,amplitude=model?model.amplitude:.35,rate=model?model.playbackRate:1/30;
  stop();const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  model=new BNEBed(w,h,ratio,seed);model.setVibration(frequency,amplitude,rate);readouts();paint();if(target)setCycle(target);
 }
 function vibrationChanged(){
  const frequency=Number(frequencyInput.value),amplitude=Number(amplitudeInput.value),rate=1/Number(playbackInput.value);
  if(seeking)stop();model.setVibration(frequency,amplitude,rate);if(model.cycleRate===0)stop();else{readouts();paint()}
 }
 play.addEventListener('click',()=>{if(playing){stop();return}if(seeking)stop();if(model.cycleRate===0)return;if(model.cycle>=16)model.reset(model.ratio,seed);if(reduced){setCycle(Math.min(16,Math.floor(model.cycle)+1));return}playing=true;lastTime=0;play.setAttribute('aria-pressed','true');play.textContent='Pause vibration Ⅱ';raf=requestAnimationFrame(frame)});
 document.querySelector('#bne-step').addEventListener('click',()=>setCycle(Math.min(16,Math.floor(model.cycle+1e-7)+1)));
 document.querySelector('#bne-reset').addEventListener('click',()=>{stop();seed+=127;model.reset(model.ratio,seed);readouts();paint()});
 contrastInput.addEventListener('input',()=>{const value=Number(contrastInput.value),target=Math.floor(model.cycle);stop();model.reset(value,seed);readouts();paint();if(target)setCycle(target)});
 cycleInput.addEventListener('input',()=>setCycle(Number(cycleInput.value)));
 frequencyInput.addEventListener('input',vibrationChanged);amplitudeInput.addEventListener('input',vibrationChanged);playbackInput.addEventListener('change',vibrationChanged);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('resize',resize);resize();
})();
