importScripts('bne-engine.js');
let bed,running=false,preparing=false,timer=null,history=[],lastSample=-1,rate=.5,wallOrigin=0,simOrigin=0,commandId=0;
function send(type){
 postMessage({type,commandId,restTime:bed.restTime,time:bed.time,settleTime:bed.settleTime,options:bed.options,dt:bed.nextDt(),initial:bed.initial,stats:bed.stats(),motion:bed.motion(),overlap:bed.peakPenetration,history,grains:bed.grains.map(p=>({x:p.x,y:p.y,r:p.r,large:p.large,angle:p.angle}))});
}
function pump(){
 timer=null;if(!preparing&&!running)return;
 try{
  const start=performance.now(),end=bed.options.duration+(bed.options.restDuration??0),elapsed=()=>bed.time+(bed.restTime??0),target=Math.min(end,simOrigin+(start-wallOrigin)/1000*rate);
  while(performance.now()-start<14){
   if(preparing){if(bed.prepareStep()){preparing=false;history=[{time:0,separation:bed.initial.separation,large:bed.initial.numberLarge,small:bed.initial.numberSmall}];send('ready');return;}}
   else{
    if(elapsed()>=end-1e-10){running=false;send('done');return;}
    const resting=bed.time>=bed.options.duration-1e-10;
    const dt=Math.min(bed.nextDt(!resting),resting?end-elapsed():bed.options.duration-bed.time);
    if(elapsed()+dt>target&&target<end)break;
    if(resting)bed.restStep(dt);else bed.step(dt);
    if(bed.time-lastSample>=.1){history.push({time:bed.time,separation:bed.stats().separation,large:bed.stats().numberLarge,small:bed.stats().numberSmall});lastSample=bed.time;}
    if(elapsed()>=target)break;
   }
  }
  send(preparing?'preparing':'frame');timer=setTimeout(pump,16);
 }catch(error){running=false;preparing=false;postMessage({type:'error',message:error.message});}
}
onmessage=({data})=>{
 if(data.type==='init'){
  clearTimeout(timer);try{bed=new BNE.BNEBed(data.options);history=[];lastSample=-1;preparing=true;running=false;pump();}catch(error){postMessage({type:'error',message:error.message});}
 }else if(data.type==='run'){commandId=data.commandId??0;rate=data.rate;wallOrigin=performance.now();simOrigin=bed.time+(bed.restTime??0);running=true;if(!timer)pump();}
 else if(data.type==='pause'){running=false;clearTimeout(timer);timer=null;commandId=data.commandId??0;send('paused');}
 else if(data.type==='rate'){rate=data.rate;wallOrigin=performance.now();simOrigin=bed.time+(bed.restTime??0);}
};
