import {collide,inside} from '../utils/collision.js';

// Fixed storage: 520 sparks × 22 trail samples. Star rain has its own 260-particle pool (780 total).
const TRAIL=22,MAX_EVENTS=12,RISE=.35,TRAIL_HZ=45;
const BLOOM_SIZE=2; // Double each bloom diameter, subject to screen and forehead clearance.
// A balanced, staggered bouquet with natural ballistic trails and small sparkling peonies.
// Rays run from a warm inner color to saturated tips; normal blending plus a soft dark
// contour keeps everything readable on bright live-stream frames.
const SPARK_SHADE='#1a0f2e',GOLD='#ffa800';
// drag: with drag k a spark never travels farther than v0/k, so v0=R·k/1.09 caps the crown at R.
const KINDS={
  crown:{drag:1.5,gravity:30,life:2.9,inner:'#d0b7ff',tips:['#ffd170','#fff0b3','#ffa951'],glitter:true},
  mum:{drag:2,gravity:38,life:2.5,inner:'#ffe7bc'},
  peony:{drag:2.6,gravity:34,life:1.9,inner:'#ffe7bc'},
  small:{drag:1.6,gravity:32,life:.7,inner:GOLD}
};
const PALETTES=[
  ['#edc787','#ffe2aa','#dbad69','#f5d69a','#a7d7ee'],
  ['#a58aef','#829fe8','#c0a5f4','#dc98d0','#94c8ef'],
  ['#ec729d','#f49aaa','#eebd77','#f4d496','#df82ad']
];
const PALETTE_INNERS=['#ffe7bc','#dfd5ff','#ffe0c3'];
// Bouquet arcs over the head, in units of the crown radius u relative to the crown center:
// crown straight above the head, chrysanthemums fanning out to both sides, peonies at the ends.
const FINALE=[
  {kind:'mum',dx:-1.05,dy:.08,r:.70,count:86,delay:0},
  {kind:'mum',dx:1.10,dy:-.30,r:.66,count:82,delay:.28},
  {kind:'peony',dx:-.15,dy:-.78,r:.48,count:60,delay:1.05},
  {kind:'mum',dx:.65,dy:.75,r:.58,count:74,delay:1.30},
  {kind:'peony',dx:-1.45,dy:.85,r:.36,count:44,delay:1.55}
];
// Fixed stage position, like the star rain: every bouquet uses the roomy layout computed for a reference head
// whose forehead sits at this fraction of the frame height, wherever the real face is.
const FIXED_FOREHEAD=.45;
// The whole bouquet, embers included, is over this long after the laugh (seconds of real time), together with
// the firework sound (~3.9 s). Late shells keep their full bloom and fade out faster instead of lingering.
const BOUQUET_SECONDS=4.0,PACE=.85,FADE=1.25;
const GENTLE=[{kind:'mum',dx:-.9,dy:0,r:.65,count:64,delay:0},{kind:'peony',dx:1,dy:.25,r:.52,count:48,delay:.48}];
export class Fireworks {
  constructor({capacity=520,random=Math.random}={}){
    this.random=random;this.pool=Array.from({length:capacity},()=>({life:0,trail:new Float32Array(TRAIL*2)}));
    this.events=[];this.flashes=[];this.sprites=new Map();this.cursor=0;this.clock=0;this.collisions=0;this.active=0;this.alive=0;
  }
  clear(){for(const p of this.pool)p.life=0;this.events.length=0;this.flashes.length=0;this.collisions=0;this.active=0;this.alive=0;this.clock=0;}
  particle(x,y,vx,vy,life,color,kind='mum',inner=KINDS[kind].inner,glitter=false,layer=1,fade=FADE){
    let p;
    for(let i=0;i<this.pool.length;i++){const q=this.pool[this.cursor];this.cursor=(this.cursor+1)%this.pool.length;if(q.life<=0){p=q;break;}}
    if(!p)return;
    this.alive++; // 存活粒子数随生成/消亡增减，避免每帧扫描整个粒子池。
    p.armed=false; // Sparks born over the face pass in front of it until they leave the outline once.
    Object.assign(p,{x,y,ox:x,oy:y,bounced:false,layer,vx,vy,life,max:life,fade,color,inner,kind,glitter,small:kind==='small',head:0,count:1,sample:0,phase:this.random()*Math.PI*2,split:kind!=='small'&&layer===1&&this.random()<.07});
    p.trail[0]=x;p.trail[1]=y;
  }
  // Reserve the complete lifetime envelope, including gravity and glow, at every edge.
  place(width,height,R,box,others,px,py,kind='crown'){
    const k=KINDS[kind],margin=22,drift=k.gravity/k.drag*(k.life+.5+.45*(BLOOM_SIZE-1));
    R=Math.max(4,Math.min(R,(width-2*margin)/2,(height-2*margin-drift)/2));
    const fit=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    return {x:fit(px,R+margin,width-R-margin),y:fit(py,R+margin,height-R-margin-drift),radius:R};
  }
  // One expression trigger becomes a staggered bouquet at a fixed place on the stage (always the full five-shell
  // layout). The real face only steers launch trails around it; sparks still bounce off it while falling.
  burst(width,height,gentle=false,poly=[]){
    const r=this.random,scale=Math.min(width,height),m=10;
    let face=null;if(poly.length>2){face=[Infinity,Infinity,-Infinity,-Infinity];for(const v of poly){face[0]=Math.min(face[0],v.x-14);face[1]=Math.min(face[1],v.y-14);face[2]=Math.max(face[2],v.x+14);face[3]=Math.max(face[3],v.y+14);}}
    const box=[width*.28-14,height*FIXED_FOREHEAD-14,width*.72+14,height*(FIXED_FOREHEAD+.28)+14];
    // Balanced off-center shells with different timing; no dominant central crown.
    const cx=box?(box[0]+box[2])/2:width*(.42+r()*.16),headTop=box?box[1]+14:height*.52;
    const u=scale*.36,cy=headTop-u*.48,start=Math.floor(r()*PALETTES.length),placed=[];
    (gentle?GENTLE:FINALE).forEach((b,i)=>{
      // Fit the entire initial bloom above the forehead, including a glow gap.
      // Later gravity carries the lower sparks into the real collider; no collision delay.
      const gap=Math.max(12,scale*.035),ceiling=22;
      // Choose distinct center heights first, then fit each full bloom into that slot.
      // Clamping oversized shells first used to collapse all centers onto the same row.
      const levels=[.39,.63,.19,.79,.46],offsets=[-.30,.30,-.13,.24,-.34];
      const band=Math.max(16,headTop-gap-ceiling);
      const preferredY=ceiling+band*levels[i%5];
      const available=Math.max(8,Math.min(preferredY-ceiling,headTop-gap-preferredY));
      const radius=Math.min(b.r*u*BLOOM_SIZE*(.95+r()*.1),available);
      const portrait=height>width*1.3;
      const preferredX=portrait?cx+offsets[i%5]*width:cx+b.dx*u*.66;
      const spot=this.place(width,height,radius,null,placed,preferredX,preferredY,b.kind);placed.push(spot);
      this.events.push({end:this.clock+BOUQUET_SECONDS*PACE,at:this.clock+b.delay+RISE+r()*.075,...spot,kind:b.kind,count:b.count,palette:PALETTES[(start+i)%PALETTES.length],inner:PALETTE_INNERS[(start+i)%PALETTES.length],gentle,launch:face&&spot.x>face[0]&&spot.x<face[2]?Math.max(face[1],spot.y+2):height+10});
      // Shells whose straight path would cross the face launch from just above the head instead.
    });
    // Bounded even if a caller accidentally triggers every frame.
    if(this.events.length>MAX_EVENTS)this.events.splice(0,this.events.length-MAX_EVENTS);
  }
  explode(e){
    const r=this.random,k=KINDS[e.kind];
    // Never draw a partial sphere: shrink the count evenly to free slots, or skip the burst.
    const free=this.pool.length-this.alive;
    const n=Math.min(e.count,free);if(n<e.count*.5)return;
    const glowLife=e.kind==='crown'?.85:.6;this.flashes.push({x:e.x,y:e.y,life:glowLife,max:glowLife,radius:e.radius*.22,gentle:e.gentle});
    if(this.flashes.length>8)this.flashes.shift();
    const tips=k.tips||e.palette,shellLife=Math.min(k.life+r()*.35+.45*(BLOOM_SIZE-1),(e.end??Infinity)-this.clock);
    // Keep the bloom intact: the fade only starts once the shell has (nearly) reached full size.
    // Outer sparks reach ~95% of their final distance after ln(1/0.05)/drag seconds.
    const fade=Math.max(.35,Math.min(FADE,shellLife-Math.log(1/.05)/k.drag));
    for(let i=0;i<n;i++){
      const angle=i/n*Math.PI*2+(r()-.5)*.032;
      // Three speed layers give a dense heart and an even spherical crown.
      const layer=i%5===0?.5:i%3===0?.76:1;
      const speed=e.radius*k.drag/1.09*layer*(.83+r()*.23);
      this.particle(e.x,e.y,Math.cos(angle)*speed,Math.sin(angle)*speed,shellLife,tips[i%tips.length],e.kind,e.inner||k.inner,!e.gentle&&layer===1,layer,fade);
    }
  }
  record(p){p.head=(p.head+1)%TRAIL;p.trail[p.head*2]=p.x;p.trail[p.head*2+1]=p.y;p.count=Math.min(TRAIL,p.count+1);}
  update(dt,poly,width,height){
    if(!this.alive&&!this.events.length&&!this.flashes.length){this.active=0;return 0;}
    // Preview pacing: stretch the firework flight and bloom by about 18%.
    dt*=.85;
    this.clock+=dt;for(let i=this.events.length-1;i>=0;i--)if(this.events[i].at<=this.clock){this.explode(this.events[i]);this.events.splice(i,1);}
    for(let i=this.flashes.length-1;i>=0;i--){this.flashes[i].life-=dt;if(this.flashes[i].life<=0)this.flashes.splice(i,1);}
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const v of poly){minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
    let active=0;
    for(const p of this.pool){
      if(p.life<=0)continue;p.life-=dt;if(p.life<=0){this.alive--;continue;}
      if(!p.armed&&!(poly.length>2&&inside(p.x,p.y,poly)))p.armed=true;
      // Sub-steps keep collisions accurate for fast sparks and keep trail sampling at TRAIL_HZ at any frame rate.
      const k=KINDS[p.kind],steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/3),Math.ceil(dt*TRAIL_HZ)),step=dt/steps,damping=Math.exp(-k.drag*step);
      for(let s=0;s<steps;s++){
        p.vx*=damping;p.vy=p.vy*damping+k.gravity*step;p.x+=p.vx*step;p.y+=p.vy*step;
        if(p.armed&&p.x>=minX-3&&p.x<=maxX+3&&p.y>=minY-3&&p.y<=maxY+3&&collide(p,poly,2)){
          this.collisions++;
          // Start the reflected trail at contact; do not connect it through the face.
          if(!p.bounced){p.head=0;p.count=1;p.trail[0]=p.x;p.trail[1]=p.y;p.sample=0;}
          p.bounced=true;this.record(p);
        }
        p.sample+=step;if(p.sample>=1/TRAIL_HZ){p.sample-=1/TRAIL_HZ;this.record(p);}
      }
      // Secondary embers use the same head collision as every primary spark.
      if(p.split&&p.max-p.life>1.3){p.split=false;for(let j=0;j<5;j++){const a=j*Math.PI*2/5;this.particle(p.x,p.y,p.vx*.25+Math.cos(a)*32,p.vy*.25+Math.sin(a)*32,Math.min(.55+this.random()*.3,p.life),p.color,'small');}}
      if(p.y>height+40||p.x< -80||p.x>width+80){p.life=0;this.alive--;continue;}active++;
    }
    this.active=active;return active;
  }
  sprite(color){
    if(this.sprites.has(color))return this.sprites.get(color);
    const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),gradient=g.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,'#fffdf2');gradient.addColorStop(.14,'#fff3d5');gradient.addColorStop(.26,color);gradient.addColorStop(.55,color+'70');gradient.addColorStop(1,color+'00');
    g.fillStyle=gradient;g.fillRect(0,0,32,32);this.sprites.set(color,c);return c;
  }
  trace(ctx,p,far,near){
    ctx.beginPath();let first=true;
    for(let k=far;k>=near;k--){const a=(p.head-k+TRAIL)%TRAIL,b=(a+1)%TRAIL;if(first){ctx.moveTo(p.trail[a*2],p.trail[a*2+1]);first=false;}ctx.lineTo(p.trail[b*2],p.trail[b*2+1]);}
  }
  shade(){
    if(this.shadeSprite)return this.shadeSprite;
    const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),gradient=g.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,SPARK_SHADE+'90');gradient.addColorStop(.5,SPARK_SHADE+'40');gradient.addColorStop(1,SPARK_SHADE+'00');g.fillStyle=gradient;g.fillRect(0,0,32,32);return this.shadeSprite=c;
  }
  // Preview study: layered translucent pigment, cached once per palette color.
  // No persistent paint buffer: every ember still expires and clears on effect changes.
  wash(color){
    const key='wash:'+color;if(this.sprites.has(key))return this.sprites.get(key);
    const c=document.createElement('canvas');c.width=64;c.height=32;const g=c.getContext('2d');
    for(let i=0;i<5;i++){
      g.save();g.translate(31+Math.sin(i*2.4)*3,16+Math.cos(i*1.7)*2);g.scale(1.9,1);
      const glow=g.createRadialGradient(0,0,0,0,0,12-i*.8);
      glow.addColorStop(0,color+'38');glow.addColorStop(.45,color+'20');glow.addColorStop(1,color+'00');
      g.fillStyle=glow;g.fillRect(-15,-15,30,30);g.restore();
    }
    this.sprites.set(key,c);return c;
  }
  star(color){
    const key='star:'+color;if(this.sprites.has(key))return this.sprites.get(key);
    const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
    g.drawImage(this.sprite(color),0,0,64,64);g.translate(32,32);
    for(let i=0;i<4;i++){
      g.rotate(Math.PI/2);const beam=g.createLinearGradient(0,0,0,28);
      beam.addColorStop(0,'#ffffff');beam.addColorStop(.16,'#fff6df');beam.addColorStop(.45,color+'b0');beam.addColorStop(1,color+'00');
      g.fillStyle=beam;g.beginPath();g.moveTo(-1.8,0);g.lineTo(0,28);g.lineTo(1.8,0);g.closePath();g.fill();
    }
    this.sprites.set(key,c);return c;
  }
  draw(ctx,gentle=false){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    const weight=gentle?.75:1;
    for(const e of this.events){
      const t=1-(e.at-this.clock)/RISE;if(t<0||t>1)continue;
      const y=e.launch+(e.y-e.launch)*(1-(1-t)**2),x=e.x+Math.sin(t*9+e.x)*1.5,tail=Math.min(60,(e.launch-y)*.5);
      ctx.globalAlpha=.18;ctx.strokeStyle=SPARK_SHADE;ctx.lineWidth=3*weight;ctx.beginPath();ctx.moveTo(x,y+tail);ctx.lineTo(x,y);ctx.stroke();
      ctx.globalAlpha=.8;ctx.strokeStyle='#ffcb83';ctx.lineWidth=1.3*weight;ctx.stroke();
      ctx.globalAlpha=.9;ctx.drawImage(this.sprite('#ffc56f'),x-6,y-6,12,12);
    }
    for(const f of this.flashes){
      const age=f.max-f.life,alpha=f.life/f.max,size=f.radius*(.7+Math.min(1,age/.22)*.8);
      ctx.globalAlpha=alpha*alpha*(f.gentle?.25:.9);ctx.drawImage(this.sprite('#ffe1b0'),f.x-size,f.y-size,size*2,size*2);
      if(!f.gentle){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha**3*.8;ctx.drawImage(this.star('#ffe1b0'),f.x-size*.7,f.y-size*.7,size*1.4,size*1.4);ctx.globalCompositeOperation='source-over';}
    }
    for(const p of this.pool){
      if(p.life<=0)continue;
      const age=p.max-p.life,fade=Math.min(1,p.life/(p.small?.5:p.fade)),ignition=Math.min(1,age/(.045+(1-p.layer)*.13));
      const pulse=Math.max(0,Math.sin(age*17+p.phase))**10;
      const shimmer=gentle?1:.68+.32*pulse,alpha=fade*ignition*shimmer;
      const dx=p.x-p.ox,dy=p.y-p.oy;
      if(!p.small&&!p.bounced){
        // Trace elapsed flight time, not a stretched spoke from a fixed hub.
        // Fast release eases into floating embers; old light burns away progressively.
        const k=KINDS[p.kind],span=.62+.2*Math.sin(p.phase)**2;
        const root=Math.max(0,(age-span)/Math.max(.001,age));
        const travel=1-Math.exp(-k.drag*age);
        const fall=t=>k.gravity/k.drag*(t-(1-Math.exp(-k.drag*t))/k.drag);
        const drop=fall(age),point=t=>{
          const time=age*t,ratio=(1-Math.exp(-k.drag*time))/Math.max(.001,travel);
          return {x:p.ox+dx*ratio,y:p.oy+(dy-drop)*ratio+fall(time)};
        };
        const line=(from,to)=>{
          ctx.beginPath();for(let i=0;i<=8;i++){const v=point(from+(to-from)*i/8);if(i)ctx.lineTo(v.x,v.y);else ctx.moveTo(v.x,v.y);}ctx.stroke();
        };
        ctx.strokeStyle=SPARK_SHADE;ctx.globalAlpha=alpha*(p.layer===1?.1:.025);ctx.lineWidth=3.2*weight;line(Math.max(root,.48),1);
        ctx.strokeStyle=p.color;ctx.globalAlpha=alpha*.18;ctx.lineWidth=4.5*weight;line(root,1);
        ctx.globalAlpha=alpha*.8;ctx.lineWidth=1.1*weight;line(root,1);
        ctx.strokeStyle=p.inner;ctx.globalAlpha=alpha*.75;ctx.lineWidth=.65*weight;line(root,root+(1-root)*.65);
        if(!gentle){
          ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#fff5df';ctx.globalAlpha=alpha*(.23+pulse*.45);ctx.lineWidth=.55;line(Math.max(root,.55),1);ctx.globalCompositeOperation='source-over';
          // Traveling highlights follow the existing flight trail without extra particles.
          for(let j=0;j<2;j++){
            const t=root+(1-root)*(.4+j*.4+.08*Math.sin(age*3+p.phase)),v=point(t),glow=2.5+2.5*pulse;
            ctx.globalAlpha=alpha*(.3+.6*pulse);ctx.drawImage(this.sprite(p.color),v.x-glow,v.y-glow,glow*2,glow*2);
          }

        }
        // Soft, irregular dabs follow the filaments, never flower-shaped petals.
        if(!gentle&&p.layer===1){
          const t=root+(1-root)*(.76+.1*Math.sin(p.phase)),v=point(t),size=(7+3*Math.sin(p.phase)**2)*Math.min(1,age/.18);
          ctx.save();ctx.translate(v.x,v.y);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=alpha*.44;
          ctx.drawImage(this.wash(p.color),-size,-size*.42,size*2,size*.84);ctx.restore();
        }
      }else if(p.count>1){
        ctx.globalAlpha=alpha*.12;ctx.strokeStyle=SPARK_SHADE;ctx.lineWidth=3*weight;this.trace(ctx,p,p.count-1,1);ctx.stroke();
        for(let band=0;band<3;band++){
          const far=Math.min(p.count-1,Math.floor((1-band/3)*p.count)),near=Math.max(1,Math.floor((1-(band+1)/3)*p.count));
          if(far<near)continue;ctx.strokeStyle=band===0?p.inner:p.color;ctx.globalAlpha=alpha*(.2+band*.27);ctx.lineWidth=(.65+band*.35)*weight;this.trace(ctx,p,far,near);ctx.stroke();
        }
      }
      const size=(p.small?5:9+4*pulse)*weight;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));
      ctx.globalAlpha=alpha*.8;ctx.drawImage(this.wash(p.color),-size*1.2,-size*.6,size*2.4,size*1.2);ctx.restore();
      ctx.globalAlpha=alpha*(p.layer===1?.45:.1);ctx.drawImage(this.shade(),p.x-size*.5,p.y-size*.5,size,size);
      ctx.globalAlpha=alpha*.9;ctx.drawImage(this.sprite(p.color),p.x-size*.5,p.y-size*.5,size,size);
      ctx.fillStyle='#fff4da';ctx.globalAlpha=alpha*.95;ctx.beginPath();ctx.arc(p.x,p.y,(p.small?.55:.8)*weight,0,Math.PI*2);ctx.fill();
      if(p.glitter&&age>.18&&!gentle){
        const glint=fade*ignition*pulse,size=10+16*pulse;
        ctx.globalCompositeOperation='lighter';ctx.globalAlpha=glint*.95;
        ctx.drawImage(this.star(p.color),p.x-size/2,p.y-size/2,size,size);
        ctx.globalCompositeOperation='source-over';
        for(let j=0;j<2;j++){
          const a=p.phase*3+j*2.1,d=3+3*Math.sin(age*4+j),spark=Math.max(0,Math.sin(age*15+p.phase+j*1.7))**8;
          ctx.globalAlpha=fade*spark*.85;ctx.drawImage(this.sprite('#ffe9a4'),p.x+Math.cos(a)*d-3,p.y+Math.sin(a)*d-3,6,6);
        }

      }
    }
    ctx.restore();
  }
}
