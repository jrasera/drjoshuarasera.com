const canvas=document.querySelector('#separator');
const ctx=canvas.getContext('2d');
const field=document.querySelector('#field');
const contact=document.querySelector('#contact');
const run=document.querySelector('#run');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let running=false,w=0,h=0,raf=0;
const colours=['#d7b39b','#83b4b0'];
function chargingLevel(){return 1-Math.exp(-4*Number(contact.value)/100)}
function updateReadouts(){
 document.querySelector('#contact-value').textContent=contact.value+'%';
 document.querySelector('#field-value').textContent=field.value+'%';
 document.querySelector('#charge-readout').textContent=chargingLevel().toFixed(2);
 const note=document.querySelector('#field-note');
 if(Number(contact.value)===0)note.textContent='With zero contact exposure, this model gives both particle classes zero charge. The field then produces no lateral deflection.';
 else if(Number(field.value)===0)note.textContent='Particles acquire charge in the tribocharger, but with no applied field they fall near the centre. Charging alone does not provide this lateral separation.';
 else note.textContent='Contact exposure builds charge towards a limit. Charged particles then deflect towards the electrode of opposite polarity. More field or more charge increases deflection.';
}
function resize(){
 const r=canvas.getBoundingClientRect();w=r.width;h=r.height;
 canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;
 ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
 draw(0);
}
function draw(time){
 ctx.clearRect(0,0,w,h);
 const cx=w/2,feedY=33,chargerTop=72,chargerBottom=210,fieldTop=260,bottom=h-83;
 const left=w*.12,right=w*.88,exposure=Number(contact.value)/100,strength=Number(field.value)/100,charge=chargingLevel();
 ctx.textAlign='center';ctx.font='10px monospace';ctx.fillStyle='#bacdd5';ctx.fillText('MIXED FEED',cx,19);
 ctx.strokeStyle='#9db2be';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(cx-24,feedY);ctx.lineTo(cx+24,feedY);ctx.lineTo(cx+7,57);ctx.lineTo(cx-7,57);ctx.closePath();ctx.stroke();
 const radius=Math.min(35,w*.09);
 ctx.strokeStyle='#58727f';ctx.strokeRect(cx-radius,chargerTop,radius*2,chargerBottom-chargerTop);
 for(let i=0;i<5;i++){
  const y=chargerTop+17+i*25;
  ctx.beginPath();ctx.moveTo(cx-radius,y);ctx.bezierCurveTo(cx+radius,y+4,cx-radius,y+17,cx+radius,y+21);ctx.strokeStyle='#7e9cab';ctx.stroke();
 }
 ctx.textAlign='left';ctx.fillStyle='#b8d7e0';ctx.font=w<500?'8px monospace':'10px monospace';
 ctx.fillText('01 / CONTACT',12,107);ctx.fillText('CHARGING',12,122);
 ctx.fillStyle='#91a9b5';ctx.fillText('q* '+charge.toFixed(2),12,146);
 ctx.textAlign='right';ctx.fillStyle='#adc5d0';ctx.fillText('HELICAL',w-12,107);ctx.fillText('TRIBOCHARGER',w-12,122);
 ctx.strokeStyle='#3e5a69';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(cx,chargerBottom);ctx.lineTo(cx,fieldTop);ctx.stroke();ctx.setLineDash([]);
 ctx.textAlign='center';ctx.font='9px monospace';ctx.fillStyle='#8da8b7';ctx.fillText('02 / ELECTROSTATIC DEFLECTION',cx,244);
 for(let y=fieldTop+22;y<bottom-5;y+=30){ctx.strokeStyle='#29424f';ctx.beginPath();ctx.moveTo(left+7,y);ctx.lineTo(right-7,y);ctx.stroke()}
 ctx.fillStyle=colours[1];ctx.fillRect(left,fieldTop,4,bottom-fieldTop-6);
 ctx.fillStyle=colours[0];ctx.fillRect(right-4,fieldTop,4,bottom-fieldTop-6);
 ctx.font='17px monospace';ctx.fillText('−',left,fieldTop-8);ctx.fillText('+',right,fieldTop-8);
 ctx.fillStyle='#91aebc';ctx.font='9px monospace';ctx.fillText('FIELD ←',cx,fieldTop+17);
 const bins=(right-left)/3;
 for(let i=0;i<3;i++){
  const x=left+i*bins;ctx.strokeStyle=i===1?'#6d8794':colours[i===0?0:1];ctx.beginPath();ctx.moveTo(x+5,bottom);ctx.lineTo(x+5,bottom+27);ctx.lineTo(x+bins-5,bottom+27);ctx.lineTo(x+bins-5,bottom);ctx.stroke();
  ctx.fillStyle=i===1?'#9fb5c1':colours[i===0?0:1];ctx.font=w<500?'8px monospace':'10px monospace';ctx.fillText(['POSITIVE','CENTRE','NEGATIVE'][i],x+bins/2,bottom+43);
 }
 ctx.fillStyle='#839eab';ctx.font='8px monospace';ctx.fillText('03 / COLLECTION',cx,h-13);
 // Dashed curves show the schematic charge-field relationship.
 for(let kind=0;kind<2;kind++){
  const sign=kind===0?-1:1;ctx.beginPath();ctx.strokeStyle=colours[kind]+'70';ctx.setLineDash([3,6]);
  for(let i=0;i<=40;i++){const f=i/40,x=cx+sign*strength*charge*w*.27*f*f,y=fieldTop+(bottom-fieldTop)*f;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.setLineDash([]);
  for(let n=0;n<17;n++){
   const t=running&&!reducedMotion?((time*.000065+n/17+kind*.019)%1):(n+.35)/17;
   let x=cx,y=54+t*(bottom-54),localCharge=0;
   if(y<chargerTop)x=cx+(kind===0?-3:3);
   else if(y<=chargerBottom){const f=(y-chargerTop)/(chargerBottom-chargerTop);x=cx+Math.sin(f*5*Math.PI+kind*.3)*radius*.72;localCharge=charge*f;}
   else {localCharge=charge;if(y>=fieldTop){const f=(y-fieldTop)/(bottom-fieldTop);x=cx+sign*strength*charge*w*.27*f*f;}x+=(n%3-1)*2;}
   ctx.fillStyle='#c7d1d4';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();
   ctx.globalAlpha=localCharge;ctx.fillStyle=colours[kind];ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
 }
 ctx.textAlign='left';
 if(running&&!reducedMotion)raf=requestAnimationFrame(draw);
}
function onControl(){updateReadouts();if(!running||reducedMotion)draw(0)}
field.addEventListener('input',onControl);contact.addEventListener('input',onControl);
run.addEventListener('click',()=>{running=!running;run.setAttribute('aria-pressed',String(running));run.textContent=running?'Pause sequence Ⅱ':'Run sequence ▶';cancelAnimationFrame(raf);draw(0)});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);if(!document.hidden)draw(0)});
window.addEventListener('resize',()=>{cancelAnimationFrame(raf);resize()});
run.textContent='Run sequence ▶';updateReadouts();resize();
