'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evaluate,defaults,configurations}=require('./value-chain-engine.js');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
const simple={id:'test',name:'Test',processCapacity:100,yield:.5,deliveryCapacity:100,capex:100,fixedCost:10,processCost:1,deliveryCost:2};
const params={...defaults,supply:100,demand:100,price:10,extractionCost:1,years:2,discountRate:0};
test('independent cash-flow accounting at zero discount',()=>{
 const r=evaluate(simple,params);close(r.feed,100);close(r.output,50);close(r.revenue,500);close(r.opex,310);close(r.annualCash,190);close(r.npv,280);assert.equal(r.payback,1);
});
test('investment at time zero and cash at year-end',()=>{
 const r=evaluate(simple,{...params,discountRate:.1});close(r.npv,-100+190/1.1+190/1.21);close(r.flows[0].presentValue,-100);
});
test('delayed operation shifts every operating cash flow and payback',()=>{
 const r=evaluate(simple,{...params,discountRate:.1,firstYear:3});assert.equal(r.flows.length,5);close(r.flows[1].cash,0);close(r.flows[2].cash,0);close(r.npv,-100+190/1.1**3+190/1.1**4);assert.equal(r.payback,3);
});
test('delivery bottleneck throttles upstream processing',()=>{
 const r=evaluate({...simple,deliveryCapacity:20},params);close(r.feed,40);close(r.output,20);assert.deepEqual(r.bottlenecks,['Delivery']);close(r.opex,130);
});
test('demand bottleneck and increased yield reduce feed requirements',()=>{
 const r=evaluate(simple,{...params,demand:10}),high=evaluate(simple,{...params,demand:10,yieldShift:.25});close(r.output,10);close(high.output,10);close(r.feed,20);close(high.feed,10/.75);assert.ok(high.opex<r.opex);
});
test('supply and processing constraints, including ties',()=>{
 assert.deepEqual(evaluate(simple,{...params,supply:20}).bottlenecks,['Feed supply']);assert.deepEqual(evaluate(simple,{...params,supply:200}).bottlenecks,['Processing']);assert.deepEqual(evaluate(simple,params).bottlenecks,['Feed supply','Processing']);
});
test('break-even price independently brings NPV to zero',()=>{
 for(const c of configurations){const r=evaluate(c,defaults);close(evaluate(c,{...defaults,price:r.breakEvenPrice}).npv,0);}
});
test('negative operating margin never pays back; zero output still pays fixed costs',()=>{
 const loss=evaluate(simple,{...params,price:0});assert.equal(loss.payback,null);assert.ok(loss.npv<0);const zero=evaluate(simple,{...params,demand:0});close(zero.annualCash,-10);assert.equal(zero.breakEvenPrice,null);
});
test('multipliers count every operating cost once',()=>{
 const r=evaluate(simple,{...params,capexFactor:2,opexFactor:2});close(r.capex,200);close(r.opex,620);close(r.npv,-440);
});
test('invalid yield, time and numerical inputs are rejected',()=>{
 for(const p of [{yieldShift:-.5},{years:1.5},{firstYear:0},{price:NaN},{discountRate:-.1}])assert.throws(()=>evaluate(simple,{...params,...p}));
});
