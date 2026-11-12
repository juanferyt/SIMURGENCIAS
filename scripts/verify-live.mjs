import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.API_URL || 'http://localhost:8000/api';
async function request(path,body){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  assert.ok(response.ok,`${path}: ${response.status}`);
  return response.json();
}
const health=await request('/health');
assert.equal(health.database,'postgresql');
const {scenarios}=await request('/simulations/compare',{seed:42});
const repeated=await request('/simulations/run',{seed:42,doctors:2});
assert.deepEqual(repeated.metrics,scenarios[1].metrics);
assert.deepEqual(repeated.patients,scenarios[1].patients);
assert.deepEqual(await request('/simulations/'+repeated.id),repeated);
assert.ok(scenarios[0].metrics.mean_wait_minutes>scenarios[3].metrics.mean_wait_minutes);
const stationary=await request('/simulations/run',{seed:42,arrival_profile:'stationary',priority_policy:'fifo'});
assert.ok(stationary.theory.reference.stable);
const report={verified_at:new Date().toISOString(),health,config:repeated.config,
  reproducibility:true,persistence:true,scenarios:scenarios.map(r=>({id:r.id,doctors:r.config.doctors,metrics:r.metrics,little:r.little})),
  stationary_reference:stationary.theory};
await mkdir(new URL('../docs/evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('../docs/evidence/live-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
