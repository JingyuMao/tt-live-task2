import {EffectTimer, RAIN_DURATION_MS} from '../utils/expression.js';

// 两种特效严格互斥：一个特效（含淡出、余烬）完全结束前，另一个的触发直接忽略，不排队、不打断。
export class ExclusiveEffects {
  constructor(rain,fireworks){this.rain=rain;this.fireworks=fireworks;this.timer=new EffectTimer(RAIN_DURATION_MS);this.mode='idle';this.now=-Infinity;}
  fireworksBusy(){const f=this.fireworks;return f.events.length>0||f.flashes.length>0||f.alive>0;}
  // 星雨在计时内或画面仍在淡出时都算进行中。
  rainBusy(now=this.now){return this.timer.active(now)||this.rain.level>0;}
  busy(now=this.now){return this.fireworksBusy()||this.rainBusy(now);}
  reset(){this.timer.reset();this.rain.clear();this.fireworks.clear();this.mode='idle';}
  // 重新允许星雨触发：只有两种特效都结束后才生效。
  rearmRain(){if(!this.busy())this.timer.rearm();}
  update(dt,state,now,{burst=false,width,height,gentle=false,poly=[]}){
    this.now=now;
    if(burst&&!this.busy(now))this.fireworks.burst(width,height,gentle,poly);
    this.fireworks.update(dt,poly,width,height);
    if(this.fireworksBusy()){
      this.timer.prev=state; // 烟花期间的微笑被消耗，结束后需重新微笑才会下星雨。
      this.mode='fireworks';
      return this.fireworks.active;
    }
    this.timer.update(state,now);
    const active=this.rain.update(dt,this.timer.active(now),width,height,gentle);
    this.mode=this.rain.level>0?'rain':'idle';return active;
  }
  draw(ctx,width,height,gentle){
    if(this.mode==='fireworks')this.fireworks.draw(ctx,gentle);
    else if(this.mode==='rain')this.rain.draw(ctx,width,height,gentle);
  }
}
