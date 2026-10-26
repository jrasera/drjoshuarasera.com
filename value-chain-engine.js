(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ValueChain=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Capacities: tonnes/year. Monetary values: constant-purchasing-power dollars.
const configurations=[
 {id:'compact',name:'Compact chain',processCapacity:60000,yield:.60,deliveryCapacity:40000,capex:35000000,fixedCost:2000000,processCost:35,deliveryCost:60},
 {id:'yield',name:'Higher-yield chain',processCapacity:60000,yield:.80,deliveryCapacity:50000,capex:50000000,fixedCost:2800000,processCost:45,deliveryCost:60},
 {id:'throughput',name:'Higher-throughput chain',processCapacity:100000,yield:.60,deliveryCapacity:70000,capex:60000000,fixedCost:3200000,processCost:32,deliveryCost:55}
];
const defaults={supply:100000,demand:45000,price:450,extractionCost:20,yieldShift:0,capexFactor:1,opexFactor:1,discountRate:.08,years:10,firstYear:1};
function evaluate(config,p){
 for(const key of Object.keys(defaults))if(!Number.isFinite(p[key]))throw new Error('Use finite model inputs.');
 if(p.supply<0||p.demand<0||p.price<0||p.extractionCost<0||p.capexFactor<0||p.opexFactor<0||p.discountRate<0||!Number.isInteger(p.years)||p.years<1||!Number.isInteger(p.firstYear)||p.firstYear<1)throw new Error('Check model input ranges.');
 const yieldValue=config.yield+p.yieldShift;
 if(yieldValue<=0||yieldValue>1)throw new Error('Saleable mass yield must be above zero and at most 100%.');
 const limits=[['Feed supply',p.supply],['Processing',config.processCapacity],['Delivery',config.deliveryCapacity/yieldValue],['Market demand',p.demand/yieldValue]];
 const feed=Math.min(...limits.map(x=>x[1])),output=feed*yieldValue,revenue=output*p.price;
 const extraction=feed*p.extractionCost*p.opexFactor,processing=feed*config.processCost*p.opexFactor,delivery=output*config.deliveryCost*p.opexFactor,fixed=config.fixedCost*p.opexFactor;
 const opex=extraction+processing+delivery+fixed,annualCash=revenue-opex,capex=config.capex*p.capexFactor;
 let cumulative=-capex,payback=capex===0?0:null,pvOutput=0,pvOpex=0;
 const flows=[{year:0,revenue:0,extraction:0,processing:0,delivery:0,fixed:0,opex:0,investment:capex,cash:-capex,discountFactor:1,presentValue:-capex,cumulative}];
 for(let year=1;year<p.firstYear+p.years;year++){
  const operating=year>=p.firstYear,discountFactor=1/Math.pow(1+p.discountRate,year),cash=operating?annualCash:0,presentValue=cash*discountFactor;
  cumulative+=presentValue;
  if(operating){pvOutput+=output*discountFactor;pvOpex+=opex*discountFactor;}
  if(payback===null&&cumulative>=0)payback=year;
  flows.push({year,revenue:operating?revenue:0,extraction:operating?extraction:0,processing:operating?processing:0,delivery:operating?delivery:0,fixed:operating?fixed:0,opex:operating?opex:0,investment:0,cash,discountFactor,presentValue,cumulative});
 }
 return {config,yieldValue,feed,output,revenue,extraction,processing,delivery,fixed,opex,annualCash,capex,flows,npv:cumulative,payback,breakEvenPrice:pvOutput>0?(capex+pvOpex)/pvOutput:null,bottlenecks:limits.filter(x=>Math.abs(x[1]-feed)<1e-7).map(x=>x[0])};
}
return {configurations,defaults,evaluate};
});
