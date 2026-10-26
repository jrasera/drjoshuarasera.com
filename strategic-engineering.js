'use strict';
(() => {
 const {configurations, defaults, evaluate} = ValueChain;
 const $ = id => document.getElementById(id), form = $('vc-controls');
 const colors = ['#9dd2db', '#dfa67a', '#b4c58c'];
 const money = n => `${n < 0 ? '−' : ''}$${Math.abs(n / 1e6).toFixed(1)}m`;
 const million = n => (n / 1e6).toFixed(2), kt = n => (n / 1000).toFixed(1);
 let selected = 'compact', results = [], parameters;
 function inputs() {
  const p = {...defaults};
  for (const input of form.querySelectorAll('input')) {
   const key = input.name, value = Number(input.value);
   p[key] = ['supply', 'demand'].includes(key) ? value * 1000 : ['yieldShift', 'discountRate'].includes(key) ? value / 100 : value;
   const unit = ['supply','demand'].includes(key) ? ' kt/year' : key === 'price' ? ' $/t' : key === 'extractionCost' ? ' $/t feed' : key === 'yieldShift' ? ' pp' : key === 'discountRate' ? '%' : key.endsWith('Factor') ? '×' : key === 'years' ? ' years' : '';
   $(input.id + '-value').value = (key === 'yieldShift' && value > 0 ? '+' : '') + (key.endsWith('Factor') ? value.toFixed(2) : value) + unit;
  }
  return p;
 }
 function svgChart(series, bars) {
  const width=520,height=250,left=54,right=16,top=15,bottom=35,w=width-left-right,h=height-top-bottom;
  const maxYear = results[0].flows.at(-1).year;
  const values=series.flatMap(s=>s.values),low=Math.min(0,...values),high=Math.max(0,...values),span=Math.max(high-low,1);
  const lower=low-.08*span,upper=high+.08*span;
  const x=year=>left+(year+.5)/(maxYear+1)*w,y=value=>top+(upper-value)/(upper-lower)*h;
  let content='';
  for(let i=0;i<=4;i++){
   const value=lower+(upper-lower)*i/4,py=y(value);
   content+=`<line x1="${left}" x2="${width-right}" y1="${py}" y2="${py}" stroke="#41535b" stroke-width=".7"/><text x="${left-8}" y="${py+4}" text-anchor="end">${Number((value/1e6).toFixed(0))}</text>`;
  }
  content+=`<line x1="${left}" x2="${width-right}" y1="${y(0)}" y2="${y(0)}" stroke="#c2d0d0" stroke-width="1"/>`;
  const tickStep=maxYear>15?5:maxYear>10?2:1;
  for(let year=0;year<=maxYear;year++)if(year%tickStep===0||year===maxYear)content+=`<text x="${x(year)}" y="${height-15}" text-anchor="middle">${year}</text>`;
  content+=`<text x="${width-right}" y="${height-1}" text-anchor="end">Year</text>`;
  for(const s of series){
   if(bars){const bw=Math.min(30,w/(maxYear+1)*.65);s.values.forEach((v,i)=>{content+=`<rect x="${x(i)-bw/2}" y="${Math.min(y(v),y(0))}" width="${bw}" height="${Math.max(.7,Math.abs(y(v)-y(0)))}" fill="${v<0?'#dfa67a':'#9dd2db'}"><title>Year ${i}: ${money(v)} net cash flow</title></rect>`;});}
   else content+=`<path d="${s.values.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.active?3:1.6}" opacity="${s.active?1:.65}" ${s.dash?'stroke-dasharray="'+s.dash+'"':''}><title>${s.name}: final NPV ${money(s.values.at(-1))}</title></path>`;
  }
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${bars?'Annual net cash flow for the selected configuration, including year-zero investment':'Cumulative discounted cash flows for all three configurations; values below zero have not recovered investment'}">${content}</svg>`;
 }
 function render() {
  parameters=inputs();results=configurations.map(c=>evaluate(c,parameters));
  const r=results.find(x=>x.config.id===selected),best=results.reduce((a,b)=>b.npv>a.npv?b:a);
  $('vc-chain').innerHTML=[['01 / EXTRACTION',`${kt(r.feed)} kt/year`,`of ${kt(parameters.supply)} available`],['02 / PROCESSING',`${kt(r.output)} kt/year product`,`${kt(r.feed)} kt feed · ${(r.yieldValue*100).toFixed(0)}% yield`],['03 / DELIVERY',`${kt(r.output)} kt/year sold`,`capacity ${kt(r.config.deliveryCapacity)} kt/year`]].map(([name,value,sub])=>`<div><span>${name}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');
  $('vc-constraint').textContent=`Limiting stage${r.bottlenecks.length>1?'s':''}: ${r.bottlenecks.join(' + ')}. Processing capacity: ${kt(r.config.processCapacity)} kt feed/year; demand: ${kt(parameters.demand)} kt product/year.`;
  $('vc-npv').textContent=money(r.npv);$('vc-npv').classList.toggle('negative',r.npv<0);
  $('vc-annual').textContent=money(r.annualCash);$('vc-payback').textContent=r.payback===null?'Not reached':r.payback===0?'Year 0':`Year ${r.payback}`;
  $('vc-cash-chart').innerHTML=svgChart([{values:r.flows.map(f=>f.cash)}],true);
  $('vc-npv-chart').innerHTML=svgChart(results.map((v,i)=>({name:v.config.name,color:colors[i],active:v.config.id===selected,dash:['','7 3','2 3'][i],values:v.flows.map(f=>f.cumulative)})),false);
  const ties=results.filter(v=>Math.abs(v.npv-best.npv)<1);
  $('vc-insight').textContent=(ties.length>1?`${ties.map(v=>v.config.name).join(' and ')} tie for the highest NPV. `:`${best.config.name} has the highest NPV of these three configurations. `)+(best.npv<0?'All three have negative NPVs under these assumptions. ':`Its NPV is ${money(best.npv)}. `)+`For the selected chain, the break-even product price is $${r.breakEvenPrice.toFixed(0)}/t, holding demand and output fixed.`;
  $('vc-comparison').innerHTML=results.map(v=>`<tr ${v.config.id===selected?'class="selected"':''}><th scope="row">${v.config.name}${Math.abs(v.npv-best.npv)<1?' <span class="vc-tag">Highest NPV</span>':''}</th><td>${kt(v.output)}</td><td>${million(v.capex)}</td><td>${million(v.npv)}</td><td>${v.breakEvenPrice.toFixed(0)}</td></tr>`).join('');
  $('vc-cashflows').innerHTML=r.flows.map(f=>`<tr><th scope="row">${f.year}</th>${[f.revenue,f.opex,f.investment,f.cash].map(v=>`<td>${million(v)}</td>`).join('')}<td>${f.discountFactor.toFixed(4)}</td><td>${million(f.presentValue)}</td><td>${million(f.cumulative)}</td></tr>`).join('');
 }
 form.addEventListener('input',render);
 form.addEventListener('reset',()=>requestAnimationFrame(render));
 document.querySelectorAll('[name="vc-config"]').forEach(input=>input.addEventListener('change',()=>{selected=input.value;render();}));
 $('vc-download').addEventListener('click',()=>{
  const r=results.find(x=>x.config.id===selected),lines=[['Configuration',r.config.name],['Units','Constant-purchasing-power USD; tonnes; annual time steps'],...Object.entries(parameters),[],['year','revenue','extraction_cost','processing_cost','delivery_cost','fixed_cost','operating_cost','investment','net_cash_flow','discount_factor','present_value','cumulative_present_value'],...r.flows.map(f=>[f.year,f.revenue,f.extraction,f.processing,f.delivery,f.fixed,f.opex,f.investment,f.cash,f.discountFactor,f.presentValue,f.cumulative])];
  const csv=lines.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`value-chain-${selected}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 render();
})();
