import test from 'node:test';
import assert from 'node:assert/strict';
import {Fireworks} from '../src/engines/fireworks.js';
import {inside} from '../src/utils/collision.js';
const face=[{x:170,y:160},{x:330,y:160},{x:330,y:360},{x:170,y:360}];
test('staggered bouquet remains bounded under repeated triggers and expires',()=>{
  const f=new Fireworks({random:()=>.5});
  for(let i=0;i<360;i++){if(i%4===0)f.burst(500,600);f.update(1/60,face,500,600);assert.ok(f.active<=520);assert.ok(f.events.length<=12);for(const p of f.pool)if(p.life>0){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.count<=22);}}
  for(let i=0;i<600;i++)f.update(1/60,[],500,600);
  assert.equal(f.active,0);assert.equal(f.events.length,0);assert.equal(f.flashes.length,0);
});
test('every spark type bounces off the actual forehead and side of the head',()=>{
  for(const kind of ['crown','mum','peony','small'])for(const side of [false,true]){
    const f=new Fireworks({random:()=>.5});f.particle(side?150:250,side?240:140,side?240:0,side?0:240,2,'#ffb000',kind);
    for(let i=0;i<15;i++)f.update(1/60,face,500,600);
    const p=f.pool[0];assert.ok(f.collisions>0,kind);assert.ok(p.bounced);assert.ok(!inside(p.x,p.y,face));
    assert.ok(side?p.vx<0:p.vy<0,'velocity reflects outward');assert.ok(p.count>1);
  }
});
test('fast primary sparks cannot tunnel through the forehead',()=>{
  const f=new Fireworks({random:()=>.5});f.particle(250,100,0,4500,2,'#ffb000','mum');
  f.update(.033,face,500,600);assert.ok(f.pool[0].bounced);assert.ok(f.pool[0].y<160);assert.ok(f.pool[0].vy<0);
});
test('moving head resolves overlapping primary sparks; missing head has no collision',()=>{
  const f=new Fireworks({random:()=>.5});f.particle(250,150,0,0,2,'#ffb000','mum');f.update(1/60,[],500,600);assert.equal(f.collisions,0);
  const moved=face.map(v=>({x:v.x,y:v.y-25}));f.update(1/60,moved,500,600);
  assert.ok(f.pool[0].bounced);assert.ok(!inside(f.pool[0].x,f.pool[0].y,moved));
});
test('five staggered shells use slower pacing; gentle mode stays lighter',()=>{
  const f=new Fireworks({random:()=>.5});f.burst(500,600);
  assert.deepEqual(f.events.map(e=>e.kind),['mum','mum','peony','mum','peony']);
  f.update(.1,[],500,600);assert.equal(f.active,0);assert.ok(Math.abs(f.clock-.085)<1e-9);
  let peak=0;for(let i=0;i<240;i++){f.update(1/60,[],500,600);peak=Math.max(peak,f.active);}assert.ok(peak>=300&&peak<=520);
  const g=new Fireworks({random:()=>.5});g.burst(500,600,true);assert.equal(g.events.length,2);
  let gentlePeak=0;for(let i=0;i<240;i++){g.update(1/60,[],500,600);gentlePeak=Math.max(gentlePeak,g.active);}assert.ok(gentlePeak>0&&gentlePeak<peak);
  g.clear();assert.equal(g.active,0);assert.equal(g.events.length,0);assert.equal(g.flashes.length,0);
});
test('a burst that cannot get enough free sparks is skipped or evenly thinned, never half drawn',()=>{
  const f=new Fireworks({capacity:100,random:()=>.5});
  for(let i=0;i<80;i++)f.particle(0,0,0,0,9,'#ffb000','mum');
  f.explode({x:250,y:200,radius:60,kind:'crown',count:130,palette:['#ff2e7e']});assert.equal(f.pool.filter(p=>p.life>0).length,80,'skipped');
  const g=new Fireworks({capacity:200,random:()=>.5});for(let i=0;i<100;i++)g.particle(0,0,0,0,9,'#ffb000','mum');
  g.explode({x:250,y:200,radius:60,kind:'crown',count:130,palette:['#ff2e7e']});
  const angles=g.pool.filter(p=>p.life>0&&p.x===250).map(p=>Math.atan2(p.vy,p.vx)).sort((a,b)=>a-b);
  assert.equal(angles.length,100);let gap=angles[0]+Math.PI*2-angles.at(-1);for(let i=1;i<angles.length;i++)gap=Math.max(gap,angles[i]-angles[i-1]);
  assert.ok(gap<Math.PI*2/100*2,'sparks cover the full circle');
});
test('every burst blooms as a full sphere: on screen including the forehead overlay',()=>{
  let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(const [w,h] of [[360,600],[500,600],[1000,560],[320,390]]){
    const head=[{x:w*.35,y:h*.35},{x:w*.65,y:h*.35},{x:w*.65,y:h*.8},{x:w*.35,y:h*.8}];
    for(let n=0;n<40;n++){const f=new Fireworks({random});f.burst(w,h,false,head);
      for(const e of f.events){assert.ok(e.x-e.radius>=0&&e.x+e.radius<=w&&e.y-e.radius>=0&&e.y+e.radius<=h,`off-screen ${w}x${h}`);assert.ok(e.radius>=Math.min(w,h)*.03);}
      for(const e of f.events.splice(0)){const solo=new Fireworks({random});solo.explode(e);for(let i=0;i<180;i++)solo.update(1/60,[],w,h);
        for(const p of solo.pool)if(p.life>0&&!p.small)assert.ok(Math.abs(p.x-e.x)<=e.radius+1,'horizontal reach');}}
  }
});
test('launch trails do not cross the face below the forehead burst',()=>{
  let seed=5;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const head=[{x:150,y:250},{x:250,y:250},{x:250,y:400},{x:150,y:400}];
  for(let n=0;n<40;n++){const f=new Fireworks({random});f.burst(400,600,false,head);
    for(const e of f.events){const crosses=e.x>136&&e.x<264&&e.launch>Math.max(236,e.y+2)&&e.y<414;assert.ok(!crosses,'shell path crosses face');}}
});
test('balanced bouquet uses both sides without a dominant centered shell',()=>{
  const f=new Fireworks({random:()=>.5});f.burst(600,700,false,[{x:240,y:315},{x:360,y:315},{x:360,y:595},{x:240,y:595}]);
  assert.ok(f.events.some(e=>e.x<300)&&f.events.some(e=>e.x>300));
  const radii=f.events.map(e=>e.radius).sort((a,b)=>b-a);assert.ok(radii[0]/radii[1]<1.2);
});
test('phone bursts bloom above the forehead and reach it later while falling',()=>{
  for(const w of [240,320,390,430]){
    const h=w*19.5/9,head=Array.from({length:36},(_,i)=>({x:w*.5+w*.16*Math.cos(i*Math.PI/18),y:h*.56+w*.2112*Math.sin(i*Math.PI/18)}));
    const top=Math.min(...head.map(p=>p.y)),f=new Fireworks({random:()=>.5});f.burst(w,h,false,head);
    assert.equal(f.events.length,5);for(const e of f.events)assert.ok(e.y+e.radius<top-10,'full bloom clears forehead');
    let collided=false;
    for(let i=0;i<420;i++){f.update(1/60,head,w,h);for(const p of f.pool)if(p.bounced){assert.ok(p.max-p.life>1,'no immediate face contact during opening');collided=true;}}
    assert.ok(collided,'falling particles still interact with the head');
  }
});
test('enlarged phone bouquet keeps distinct heights and all three color families',()=>{
 for(const w of [240,320,390,430]){
  const h=w*19.5/9,top=h*.56-w*.2112;
  const f=new Fireworks({random:()=>.5});f.burst(w,h,false,[{x:w*.34,y:top},{x:w*.66,y:top},{x:w*.66,y:h*.7},{x:w*.34,y:h*.7}]);
  const ys=f.events.map(e=>e.y);assert.ok(Math.max(...ys)-Math.min(...ys)>w*.3,'visibly staggered heights');
  assert.equal(new Set(f.events.map(e=>e.palette.join(','))).size,3);assert.equal(new Set(f.events.map(e=>e.inner)).size,3);
 }
});
test('limited forehead space selects three colors and shells; roomy space restores five',()=>{
 for(const w of [240,320,390,430]){
  const h=w*19.5/9,head=ratio=>[{x:w*.3,y:h*ratio},{x:w*.7,y:h*ratio},{x:w*.7,y:h*.8},{x:w*.3,y:h*.8}];
  for(const [ratio,count] of [[.15,3],[.299,3],[.301,5],[.45,5]]){
   const f=new Fireworks({random:()=>.5});f.burst(w,h,false,head(ratio));assert.equal(f.events.length,count);
   assert.equal(new Set(f.events.map(e=>e.palette.join(','))).size,3);
   const original=f.events.map(e=>({x:e.x,y:e.y,radius:e.radius}));f.update(.05,head(.45),w,h);
   assert.deepEqual(f.events.map(e=>({x:e.x,y:e.y,radius:e.radius})),original,'moving head does not recompose the running burst');
  }
  const f=new Fireworks();f.burst(w,h,true,head(.15));assert.equal(f.events.length,2,'gentle mode remains lighter');
 }
});
