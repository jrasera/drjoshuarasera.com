// Reproducible paired Albino comparison. This reports evidence, never forces a pass.
'use strict';
const {BNEBed}=require('./bne-engine.js');
const fs=require('node:fs');
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const seeds=(args.seeds||'87413,87540,87667,87794,87921').split(',').map(Number);
const modulus=Number(args.modulus||63e9),normalDamping=Number(args.normal||0),shearDamping=Number(args.shear||0);
const runs=[];
for(const seed of seeds)for(const condition of [7,8]){
 const bed=new BNEBed({mode:'mixture',solver:'hertz',initialization:'random',smallCount:250,largeCount:20,smallMin:.5,smallMax:.75,largeMin:1.7,largeMax:2.1,cellWidth:9,cellHeight:100,frequency:15,amplitude:condition===7?1:1.5,duration:10,youngModulus:modulus,poisson:.16,friction:Math.tan(25*Math.PI/180),wallFriction:Math.tan(25*Math.PI/180),normalDamping,shearDamping,seed});
 let steps=0,next=1;
 while(!bed.prepared){bed.prepareStep();steps++;}
 const initial=bed.stats();
 process.stderr.write('Prepared test '+condition+', seed '+seed+' after '+bed.settleTime.toFixed(2)+' s settling.\n');
 while(bed.time<bed.options.duration-1e-10){
  bed.step(Math.min(bed.nextDt(),bed.options.duration-bed.time));steps++;
  if(bed.time>=next){process.stderr.write('Test '+condition+', seed '+seed+': '+next+' / 10 s\n');next++;}
 }
 const endOfShaking=bed.stats();
 while(bed.restTime<bed.options.restDuration-1e-10){bed.restStep(Math.min(bed.nextDt(false),bed.options.restDuration-bed.restTime));steps++;}
 runs.push({condition,seed,steps,settleTime:bed.settleTime,options:bed.options,initial,endOfShaking,rested:bed.stats(),peakOverlapPerRadius:bed.peakPenetration});
 if(args.output)fs.writeFileSync(args.output,JSON.stringify(report(),null,2)+'\n');
}
function report(){return {validated:false,source:'https://doi.org/10.1016/j.actaastro.2025.11.073',contactReference:'https://docs.itascacg.com/pfc700/common/contactmodel/hertz/doc/manual/cmhertz.html',limitations:['Planar disks, not the published 3D spheres','20/250 counts and uniform bounds do not preserve 1B/2S mass composition or measured PSD','Damping ratios and wall friction are explicit assumptions','10 s here means shaking duration; confirm published timing against original script','Modulus below 63 GPa is a stiffness reduction, not paper glass'],targets:{7:{experimentalNumberSeparationMm:-.4,experimentalLargeAbove:[.69,.44,.24],demLargeAbove:[.73,.44,.26]},8:{experimentalNumberSeparationMm:4.1,demNumberSeparationMm:5.3,experimentalLargeAbove:[.77,.61,.39],demLargeAbove:[.89,.81,.49]}},runs};}
process.stdout.write(JSON.stringify(report(),null,2)+'\n');
