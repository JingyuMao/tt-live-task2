// Cloud-lit star rain. Textures are generated once; no video or per-frame blur.
// Drawn with normal blending plus soft dark contours so it reads on bright backgrounds.
const MIST_TIME=.65;
const MIST_PARTS=[
 [.13,.68,.15,.22],[.24,.56,.18,.28],[.35,.39,.17,.29],[.44,.26,.15,.24],
 [.55,.38,.19,.31],[.67,.49,.18,.28],[.78,.62,.17,.24],[.89,.73,.12,.15],
 [.23,.73,.19,.20],[.40,.67,.21,.25],[.59,.72,.22,.23],[.72,.75,.18,.17],
 [.31,.51,.12,.20],[.50,.46,.14,.23],[.62,.56,.13,.22],[.40,.78,.16,.15],
 [.16,.77,.12,.12],[.53,.79,.15,.13]
];
// Saturated gold / amber / blue: pale tones disappeared on bright live-stream frames.
const COLORS=['#ffb347','#ffda83','#74baff'];
const RAIN_SHADE='#140c26';
const lerp=(a,b,t)=>a+(b-a)*t;
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),u),lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
function fbm(x,y){let total=0,weight=.5;for(let i=0;i<5;i++){total+=noise(x,y)*weight;x=x*2.03+7;y=y*2.03+3;weight*=.5;}return total;}
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export class StarRain {
  constructor({capacity=260,random=Math.random}={}){
    this.random=random;this.pool=Array.from({length:capacity},()=>({life:0}));this.cursor=0;this.level=0;this.clock=0;this.budget=0;this.active=0;this.wasOn=false;this.cloudAge=0;this.textures=null;
  }
  clear(){for(const p of this.pool)p.life=0;this.level=0;this.budget=0;this.clock=0;this.active=0;this.wasOn=false;this.cloudAge=0;}
  formation(gentle=false){
    const progress=Math.min(1,this.cloudAge/MIST_TIME);
    return {progress,spread:progress,scaleX:1,scaleY:1};
  }
  mistState(index,gentle=false){
    const [tx,ty,rx,ry]=MIST_PARTS[index],delay=hash(index,11)*.10;
    const t=Math.max(0,Math.min(1,(this.cloudAge-delay)/.55));
    const travel=1-(1-t)**3,inflate=t*t*(3-2*t),curl=Math.sin(t*Math.PI)*(1-t);
    const phase=index*2.399;
    // Distinct eddies: each wisp starts at a different inner source, curls,
    // billows and thickens. There is no whole-cloud reveal or scale transform.
    const x=gentle?tx:lerp(.44+Math.sin(phase)*.06,tx,travel)+Math.cos(phase)*curl*.065;
    const y=gentle?ty:lerp(.68+Math.cos(phase)*.05,ty,travel)+Math.sin(phase)*curl*.10;
    const breathe=gentle?0:Math.sin(this.clock*.65+phase)*.007*t;
    return {x:x+breathe,y:y+breathe*.5,rx:rx*(gentle?1:.32+.68*inflate),ry:ry*(gentle?1:.42+.58*inflate),
      angle:gentle?0:Math.sin(phase)*curl*.5,alpha:Math.min(1,t*5)*(.28+.72*inflate),progress:t};
  }
  geometry(w,h){const phone=h>w*1.3,width=w*.94,height=Math.min(h*.30,w*(phone?.46:.39)),top=h*(phone?.04:.015);return {x:w*.03,y:top,width,height,base:top+height*.82};}
  spawn(w,h,seed=false){
    let p;for(let i=0;i<this.pool.length;i++){const q=this.pool[this.cursor];this.cursor=(this.cursor+1)%this.pool.length;if(q.life<=0){p=q;break;}}if(!p)return;
    const r=this.random,g=this.geometry(w,h),depth=r(),t=r();
    // More warm dust falls from the glowing heart, cooler silver near the edges.
    const u=r()<.58?(r()+r()+r())/3:r(),x=g.x+g.width*(.055+u*.89),y=g.base+(seed?r()*(h-g.base):-r()*8);
    const phone=h>w*1.3,fit=Math.min(1,w/390);
    const speed=h*(phone?.14+depth*.13:.10+depth*.15),color=Math.abs(u-.5)<.27||r()<.45?(r()<.65?0:1):2;
    Object.assign(p,{x,y,originY:g.base,vx:(r()-.5)*6,vy:speed,life:(h-y+24)/speed,max:(h-y+24)/speed,age:seed?r()*2:0,depth,color,
      star:t>.84,trail:t>.61,size:(t>.84?1.8+depth*2.6:.45+depth*1.15)*Math.max(.7,fit),length:Math.min((.045+r()*.12)*h,w*.2),phase:r()*Math.PI*2,spin:(r()-.5)*.65,sway:3+r()*7});
  }
  update(dt,enabled,w,h,gentle=false){
    if(!enabled&&this.level===0&&this.active===0&&!this.wasOn)return 0;
    dt=Math.max(0,Math.min(dt,.05));this.clock+=dt;
    // Resume a partially visible cloud; only a fully faded cloud starts over.
    if(enabled)this.cloudAge=Math.min(MIST_TIME,this.cloudAge+dt);
    this.level+=(Number(enabled)-this.level)*(1-Math.exp(-dt*(enabled?3.5:4)));
    if(enabled&&!this.wasOn){const density=w<=440&&h>w*1.3?.72:1;const count=Math.round((gentle?32:100)*density);for(let i=0;i<count;i++)this.spawn(w,h,true);}
    this.wasOn=enabled;
    if(enabled){this.budget+=dt*(gentle?18:55)*(w<=440&&h>w*1.3?.72:1);while(this.budget>=1){this.spawn(w,h);this.budget--;}}else this.budget=0;
    let active=0;for(const p of this.pool){if(p.life<=0)continue;p.life-=dt;p.age+=dt;p.x+=(p.vx+Math.sin(p.age*1.2+p.phase)*p.sway)*dt;p.y+=p.vy*dt;if(p.y>h+24)p.life=0;if(p.life>0)active++;}
    if(!enabled&&this.level<.008){this.level=0;this.cloudAge=0;for(const p of this.pool)p.life=0;active=0;}this.active=active;return active;
  }
  prepare(){
    if(this.textures)return;
    const mist=[];
    // Six small, independently textured fog sprites, cached for the entire session.
    for(let variant=0;variant<6;variant++){
      const patch=makeCanvas(96,96),c=patch.getContext('2d'),data=c.createImageData(96,96);
      for(let y=0;y<96;y++)for(let x=0;x<96;x++){
        const u=x/96,v=y/96,dx=(u-.5)*2,dy=(v-.5)*2;
        const n=fbm(u*5+variant*9,v*5+variant*3),fine=noise(u*29+variant,v*31);
        const shape=1-dx*dx-dy*dy+(n-.48)*.65;
        const edge=Math.max(0,Math.min(1,shape*1.8));
        const alpha=edge*edge*(3-2*edge)*(.5+n*.5)*Math.min(1,u*14,(1-u)*14,v*14,(1-v)*14);
        const light=Math.max(0,Math.min(1,.18+n*.65+fine*.1+(1-v)*.16));
        const warm=variant>=4?Math.exp(-((dx/.95)**2)-((v-.67)/.5)**2)*(.35+n*.55):0;
        const i=(y*96+x)*4;data.data[i]=lerp(26+light*89,240,warm);data.data[i+1]=lerp(44+light*104,176,warm);data.data[i+2]=lerp(62+light*118,98,warm);data.data[i+3]=alpha*250;
      }
      c.putImageData(data,0,0);mist.push(patch);
    }
    const beam=makeCanvas(160,320),b=beam.getContext('2d');
    for(let i=0;i<3;i++){const x=[57,90,118][i],g=b.createRadialGradient(x,20,0,x,65,150);g.addColorStop(0,i===2?'#2f8cff30':'#ffa80048');g.addColorStop(.45,i===2?'#2f8cff14':'#ffb8301e');g.addColorStop(1,'#ffffff00');b.fillStyle=g;b.fillRect(0,0,160,320);}
    // Feather the cached light shafts on every edge to avoid a rectangular overlay.
    b.globalCompositeOperation='destination-in';
    const horizontal=b.createLinearGradient(0,0,160,0);horizontal.addColorStop(0,'#00000000');horizontal.addColorStop(.25,'#000');horizontal.addColorStop(.75,'#000');horizontal.addColorStop(1,'#00000000');b.fillStyle=horizontal;b.fillRect(0,0,160,320);
    const vertical=b.createLinearGradient(0,0,0,320);vertical.addColorStop(0,'#00000000');vertical.addColorStop(.12,'#000');vertical.addColorStop(.7,'#00000080');vertical.addColorStop(1,'#00000000');b.fillStyle=vertical;b.fillRect(0,0,160,320);
    const shade=makeCanvas(32,32),sh=shade.getContext('2d'),sg=sh.createRadialGradient(16,16,0,16,16,16);
    sg.addColorStop(0,RAIN_SHADE+'a0');sg.addColorStop(.45,RAIN_SHADE+'48');sg.addColorStop(1,RAIN_SHADE+'00');sh.fillStyle=sg;sh.fillRect(0,0,32,32);
    const sprites=COLORS.map(color=>{const glow=makeCanvas(32,32),g=glow.getContext('2d'),radial=g.createRadialGradient(16,16,0,16,16,16);radial.addColorStop(0,'#fffbea');radial.addColorStop(.16,color);radial.addColorStop(.45,color+'b0');radial.addColorStop(.75,color+'40');radial.addColorStop(1,color+'00');g.fillStyle=radial;g.fillRect(0,0,32,32);
      const wash=makeCanvas(48,48),wc=wash.getContext('2d');
      // Reference-inspired translucent pigment layers, baked once instead of frame noise.
      for(let j=0;j<4;j++){
        wc.save();wc.translate(24+Math.sin(j*2.4)*2,24+Math.cos(j*1.8)*2);wc.rotate(j*.8);wc.scale(1.2,.85);
        const tint=wc.createRadialGradient(0,0,0,0,0,18-j);
        tint.addColorStop(0,color+'38');tint.addColorStop(.5,color+'22');tint.addColorStop(1,color+'00');
        wc.fillStyle=tint;wc.fillRect(-24,-24,48,48);wc.restore();
      }
      const star=makeCanvas(32,32),s=star.getContext('2d');s.drawImage(glow,0,0);s.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=j%2?3.4:8;const x=16+Math.cos(a)*r,y=16+Math.sin(a)*r;j?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();s.fillStyle=color;s.fill();s.lineJoin='round';s.lineWidth=1.2;s.strokeStyle=RAIN_SHADE+'99';s.stroke();
      s.beginPath();s.arc(16,16,1.8,0,Math.PI*2);s.fillStyle='#fffbea';s.fill();
      // Streak: dark 4px underlay with a 2px saturated core, brightest at the falling head.
      const line=makeCanvas(6,128),l=line.getContext('2d'),under=l.createLinearGradient(0,0,0,128);under.addColorStop(0,RAIN_SHADE+'00');under.addColorStop(1,RAIN_SHADE+'55');l.fillStyle=under;l.fillRect(1,0,4,128);
      const lg=l.createLinearGradient(0,0,0,128);lg.addColorStop(0,color+'00');lg.addColorStop(.55,color+'70');lg.addColorStop(1,color);l.fillStyle=lg;l.fillRect(2,0,2,128);return {glow,star,line,wash};});
    this.textures={mist,beam,shade,sprites};
  }
  draw(ctx,w,h,gentle=false){
    if(this.level<.005)return;this.prepare();const g=this.geometry(w,h),{mist,beam,shade,sprites}=this.textures;
    ctx.save();ctx.globalAlpha=this.level*.5;ctx.drawImage(beam,g.x+g.width*.12,g.base-20,g.width*.76,h-g.base+20);
    const f=this.formation(gentle);
    for(let i=0;i<MIST_PARTS.length;i++){
      const p=this.mistState(i,gentle);if(p.alpha<=0)continue;
      ctx.save();ctx.globalAlpha=this.level*p.alpha;
      ctx.translate(g.x+g.width*p.x,g.y+g.height*p.y);ctx.rotate(p.angle);
      const warm=i===9||i===15||i===17,texture=mist[warm?4+i%2:i%4];
      ctx.drawImage(texture,-g.width*p.rx,-g.height*p.ry,g.width*p.rx*2,g.height*p.ry*2);ctx.restore();
    }
    for(const p of this.pool){
      if(p.life<=0)continue;
      const reveal=Math.min(1,p.age/.38),grow=reveal*reveal*(3-2*reveal);
      const shimmer=gentle?1:.68+.32*Math.sin(p.age*3.2+p.phase)**2;
      const a=this.level*grow*Math.min(1,p.life*2)*shimmer,s=sprites[p.color];
      if(p.trail){
        const length=Math.max(0,Math.min(p.length,p.y-p.originY)),duration=length/p.vy;
        // Analytic history of the same downward drift used by the particle simulation.
        const at=t=>({x:p.x-p.vx*duration*(1-t)+p.sway/1.2*(Math.cos(p.age*1.2+p.phase)-Math.cos((p.age-duration*(1-t))*1.2+p.phase)),y:p.y-length*(1-t)});
        ctx.lineCap='round';
        for(let band=0;band<3;band++){
          const from=band/3,to=(band+1)/3;
          ctx.beginPath();for(let j=0;j<=4;j++){const q=at(from+(to-from)*j/4);j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}
          ctx.strokeStyle=RAIN_SHADE;ctx.globalAlpha=a*(.025+band*.025);ctx.lineWidth=3;ctx.stroke();
          ctx.strokeStyle=COLORS[p.color];ctx.globalAlpha=a*(.1+band*.22);ctx.lineWidth=.7+p.depth*.7;ctx.stroke();
        }
      }
      const size=p.size*(p.star?6:7)*(.55+.45*grow);
      ctx.globalAlpha=a*(p.star?.65:.4);ctx.drawImage(s.wash,p.x-size,p.y-size,size*2,size*2);
      ctx.globalAlpha=a*.38;ctx.drawImage(shade,p.x-size*.55,p.y-size*.55,size*1.1,size*1.1);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(gentle?0:p.phase*.2+p.age*p.spin);
      ctx.globalAlpha=a;ctx.drawImage(p.star?s.star:s.glow,-size/2,-size/2,size,size);ctx.restore();
      if(!p.star&&!gentle){
        // Soft satellite dust replaces the rigid square specks, with no extra pool entries.
        for(let j=0;j<2;j++){
          const ox=Math.sin(p.phase+j*2.4+p.age*.35)*15,oy=Math.cos(p.phase*2+j)*20,d=3+p.depth*3;
          ctx.globalAlpha=a*(.22+.2*Math.sin(p.age*2+p.phase+j)**2);ctx.drawImage(s.glow,p.x+ox-d/2,p.y+oy-d/2,d,d);
        }
      }
    }
    // Fine glitter within the cloud itself uses a small deterministic loop, no objects.
    for(let i=0;i<(gentle?18:54);i++){const x=g.x+g.width*(.12+hash(i,4)*.76),y=g.y+g.height*(.26+hash(i,7)*.49);const revealed=Math.max(0,Math.min(1,(f.progress-.18)*1.8));ctx.globalAlpha=this.level*revealed*(.3+.7*Math.sin(this.clock*1.3+i)**8);ctx.fillStyle='#ffd34d';ctx.fillRect(x-1,y-1,2,2);}
    ctx.restore();
  }
}
