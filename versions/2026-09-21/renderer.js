(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const COLORS = new Map();
  function color(hex, alpha = 1) {
    if (Array.isArray(hex)) return [hex[0], hex[1], hex[2], hex[3] * alpha];
    if (!COLORS.has(hex)) { const h = hex.replace('#', ''); COLORS.set(hex, [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1]); }
    const c = COLORS.get(hex); return [c[0], c[1], c[2], alpha];
  }
  const ink = '#14192c', cream = '#eee9d9', green = '#c5ef70';
  class SpaceRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'high-performance' });
      if (!this.gl) throw new Error('WebGL is unavailable');
      const gl = this.gl;
      this.program = this.makeProgram(`
        attribute vec2 a_position; attribute vec4 a_color; attribute vec2 a_uv;
        uniform vec2 u_world; varying vec4 v_color; varying vec2 v_uv;
        void main(){gl_Position=vec4(a_position/u_world*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);v_color=a_color;v_uv=a_uv;}
      `, `precision mediump float; varying vec4 v_color; varying vec2 v_uv; uniform sampler2D u_atlas;
        void main(){gl_FragColor=v_color;if(v_uv.x>=0.)gl_FragColor.a*=texture2D(u_atlas,v_uv).a;}`);
      this.background = this.makeProgram(`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.,1.);}`, `
        precision highp float; uniform vec2 u_resolution; uniform float u_time; uniform float u_scroll;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float stars(vec2 uv,float grid,float layer){vec2 p=uv*grid;vec2 cell=floor(p);vec2 f=fract(p);vec2 o=vec2(hash(cell+layer),hash(cell+91.7+layer));float r=hash(cell+34.2);float d=length(f-o);return smoothstep(.018+.018*r,0.,d)*step(.77,r)*(.35+.3*sin(u_time*.7+r*25.));}
        void main(){vec2 uv=gl_FragCoord.xy/u_resolution;vec2 aspect=vec2(u_resolution.x/u_resolution.y,1.);vec2 p=uv*aspect;
          vec3 c=vec3(.057,.071,.122);
          c+=vec3(.027,.023,.07)*exp(-length((uv-vec2(.78,.56))*vec2(1.2,1.9))*3.);
          c+=vec3(.012,.025,.015)*exp(-length((uv-vec2(.47,.18))*vec2(1.8,1.))*5.);
          float s=stars(p+vec2(u_scroll*.012,0.),24.,1.)+stars(p+vec2(u_scroll*.025,0.),45.,7.)*.7;
          c+=vec3(.64,.67,.81)*s;c*=1.-.18*length(uv-.5);gl_FragColor=vec4(c,1.);
        }`);
      this.buffer = gl.createBuffer(); this.bgBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      this.vertices = new Float32Array(1500000); this.count = 0; this.matrix = [1,0,0,1,0,0]; this.scroll = 0;
      this.locations = { p: gl.getAttribLocation(this.program, 'a_position'), c: gl.getAttribLocation(this.program, 'a_color'), uv: gl.getAttribLocation(this.program, 'a_uv'), world: gl.getUniformLocation(this.program, 'u_world') };
      this.bgLocations = { p: gl.getAttribLocation(this.background, 'a_position'), resolution: gl.getUniformLocation(this.background, 'u_resolution'), time: gl.getUniformLocation(this.background, 'u_time'), scroll: gl.getUniformLocation(this.background, 'u_scroll') };
      this.createAtlas();
    }
    makeProgram(vertex, fragment) {
      const gl = this.gl;
      const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const program = gl.createProgram(), vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)); return program;
    }
    createAtlas() {
      const atlas = document.createElement('canvas'); atlas.width = 512; atlas.height = 512;
      const ctx = atlas.getContext('2d'); ctx.font = 'bold 29px monospace'; ctx.fillStyle = 'white'; ctx.textBaseline = 'top';
      for (let i = 32; i < 127; i++) ctx.fillText(String.fromCharCode(i), ((i - 32) % 16) * 32 + 5, Math.floor((i - 32) / 16) * 48 + 5);
      const gl = this.gl; this.atlas = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.atlas); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) { this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); }
      this.w = 1440; this.h = 1440 * h / w; this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      return { w: this.w, h: this.h };
    }
    vertex(x, y, c, u = -1, v = -1) {
      const m = this.matrix; let i = this.count;
      if (i + 8 > this.vertices.length) { const bigger = new Float32Array(this.vertices.length * 2); bigger.set(this.vertices); this.vertices = bigger; }
      this.vertices[i++] = x*m[0]+y*m[2]+m[4]; this.vertices[i++] = x*m[1]+y*m[3]+m[5];
      this.vertices[i++] = c[0]; this.vertices[i++] = c[1]; this.vertices[i++] = c[2]; this.vertices[i++] = c[3]; this.vertices[i++] = u; this.vertices[i++] = v; this.count = i;
    }
    transform(x, y, rotation, scale, draw) {
      const old = this.matrix, c = Math.cos(rotation)*scale, s = Math.sin(rotation)*scale;
      this.matrix = [old[0]*c+old[2]*s,old[1]*c+old[3]*s,old[2]*c-old[0]*s,old[3]*c-old[1]*s,old[0]*x+old[2]*y+old[4],old[1]*x+old[3]*y+old[5]];
      draw(); this.matrix = old;
    }
    polygon(points, fill, alpha = 1) { const c = color(fill, alpha); for (let i = 1; i < points.length - 1; i++) { this.vertex(...points[0],c); this.vertex(...points[i],c); this.vertex(...points[i+1],c); } }
    rect(x,y,w,h,fill,alpha=1) { this.polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],fill,alpha); }
    ellipse(x,y,rx,ry,fill,alpha=1,steps=40,edge=null) {
      const c = color(fill,alpha), e = edge ? color(edge,alpha) : c;
      for (let i=0;i<steps;i++){const a=i*TAU/steps,b=(i+1)*TAU/steps;this.vertex(x,y,c);this.vertex(x+Math.cos(a)*rx,y+Math.sin(a)*ry,e);this.vertex(x+Math.cos(b)*rx,y+Math.sin(b)*ry,e);}
    }
    circle(x,y,r,fill,alpha=1,steps=40,edge=null){this.ellipse(x,y,r,r,fill,alpha,steps,edge);}
    line(x1,y1,x2,y2,width,fill,alpha=1){const a=Math.atan2(y2-y1,x2-x1),x=Math.sin(a)*width/2,y=-Math.cos(a)*width/2;this.polygon([[x1+x,y1+y],[x2+x,y2+y],[x2-x,y2-y],[x1-x,y1-y]],fill,alpha);}
    capsule(x1,y1,x2,y2,width,fill,alpha=1){this.line(x1,y1,x2,y2,width,fill,alpha);this.circle(x1,y1,width/2,fill,alpha,20);this.circle(x2,y2,width/2,fill,alpha,20);}
    ring(x,y,rx,ry,width,fill,alpha=1,start=0,end=TAU,steps=80){for(let i=0;i<steps;i++){const a=start+(end-start)*i/steps,b=start+(end-start)*(i+1)/steps;this.polygon([[x+Math.cos(a)*(rx-width/2),y+Math.sin(a)*(ry-width/2)],[x+Math.cos(a)*(rx+width/2),y+Math.sin(a)*(ry+width/2)],[x+Math.cos(b)*(rx+width/2),y+Math.sin(b)*(ry+width/2)],[x+Math.cos(b)*(rx-width/2),y+Math.sin(b)*(ry-width/2)]],fill,alpha);}}
    star(x,y,r,fill,alpha=1){this.polygon([[x,y-r],[x+r*.2,y-r*.2],[x+r,y],[x+r*.2,y+r*.2],[x,y+r],[x-r*.2,y+r*.2],[x-r,y],[x-r*.2,y-r*.2]],fill,alpha);}
    text(text,x,y,size,fill=cream,alpha=1,center=true){text=text.replaceAll('−','-').replaceAll('✧','*');const w=size*.64,c=color(fill,alpha);if(center)x-=text.length*w/2;for(const char of text){const n=char.charCodeAt(0)-32;if(n<0||n>94){x+=w;continue;}const u=(n%16)*32/512,v=Math.floor(n/16)*48/512,u2=u+32/512,v2=v+48/512;this.vertex(x,y,c,u,v);this.vertex(x+w,y,c,u2,v);this.vertex(x+w,y+size*1.05,c,u2,v2);this.vertex(x,y,c,u,v);this.vertex(x+w,y+size*1.05,c,u2,v2);this.vertex(x,y+size*1.05,c,u,v2);x+=w;}}
    planet(x,y,r,kind,time=0){
      const palette=[['#89bba7','#457e85','#b4d4ac'],['#bca4e6','#72669c','#d0b5e9'],['#e5ba75','#9f765b','#f0d6a2'],['#dc947e','#955e66','#ecc0a0'],['#ffce82','#e88b55','#ffedb3']][kind];
      if(kind===4){for(let i=6;i>0;i--)this.circle(x,y,r+i*13,'#ffb768',.025,80);for(let i=0;i<16;i++){const a=i*TAU/16+time*.025;this.line(x+Math.cos(a)*(r+13),y+Math.sin(a)*(r+13),x+Math.cos(a)*(r+23+(i%3)*6),y+Math.sin(a)*(r+23+(i%3)*6),3,'#ffbb70',.3);}}
      this.transform(x,y,-.25,1,()=>{
        if(kind===1)this.ring(0,0,r*1.7,r*.43,r*.18,'#aea0cf',.47,Math.PI,TAU);
        this.circle(0,0,r,palette[0],1,96,palette[1]);
        // Thin clipped bands give each planet a hand-drawn, atmospheric surface.
        for(let i=0;i<12;i++){const yy=-r*.87+i*r*.15,half=Math.sqrt(Math.max(0,r*r-yy*yy));this.ellipse(Math.sin(i*7)*r*.08,yy,half*.91,r*.028,palette[i%2===0?2:1],i%3===0?.28:.12,40);}
        if(kind===0){this.polygon([[-r*.55,-r*.5],[-r*.07,-r*.68],[r*.2,-r*.36],[r*.04,-r*.1],[-r*.27,-r*.08],[-r*.31,r*.26],[-r*.5,r*.12]],'#b3c28c',.7);this.polygon([[r*.3,r*.07],[r*.64,r*.2],[r*.45,r*.63],[r*.19,r*.38]],'#b3c28c',.7);}
        if(kind===3){this.ellipse(-r*.3,-r*.15,r*.19,r*.15,palette[1],.6);this.ellipse(r*.26,r*.4,r*.13,r*.1,palette[1],.5);this.ring(-r*.3,-r*.15,r*.2,r*.16,3,palette[2],.24);}
        this.ring(0,0,r-1,r-1,2,palette[2],.2,Math.PI*.95,Math.PI*1.9);
        if(kind===1){this.ring(0,0,r*1.7,r*.43,r*.18,'#b2a1cb',.75,0,Math.PI);this.ring(0,0,r*1.7+10,r*.43+4,2,'#d1bedb',.22,0,Math.PI);}
      });
    }
    astronaut(x,y,angle,scale,time,boost=false,hurt=false){
      this.transform(x,y,angle,scale,()=>{
        const boot=Math.sin(time*3)*3;
        // Pack, legs and gloves sit behind the helmet and chest.
        this.capsule(-28,-5,-29,34,40,ink);this.capsule(-29,-4,-30,30,30,'#bda7d5');this.line(-35,0,-37,23,4,'#89789f');
        this.capsule(-5,29,-17,61+boot,25,ink);this.capsule(17,27,34,54-boot,25,ink);
        this.capsule(-5,28,-17,60+boot,17,cream);this.capsule(17,28,34,53-boot,17,'#c7d6c3');
        this.capsule(-20,58+boot,-7,64+boot,21,ink);this.capsule(-20,58+boot,-7,61+boot,15,'#b6a1d4');
        this.capsule(31,52-boot,43,49-boot,21,ink);this.capsule(32,51-boot,43,47-boot,15,'#b6a1d4');
        this.capsule(-20,3,-49,22+Math.sin(time*2)*4,22,ink);this.capsule(-20,3,-49,22+Math.sin(time*2)*4,15,cream);this.circle(-51,25+Math.sin(time*2)*4,10,'#b7a3d4');
        this.capsule(19,1,45,-20,22,ink);this.capsule(19,1,45,-20,15,cream);this.circle(48,-24,10,'#b7a3d4');this.capsule(43,-27,45,-34,7,'#b7a3d4');
        this.ellipse(2,12,31,36,ink);this.ellipse(2,10,26,31,hurt?'#fda69a':'#dce1c9');
        this.ellipse(12,15,14,25,'#acc8b3',.42);this.rect(-14,7,30,20,ink);this.rect(-11,9,24,14,'#9eaead');this.circle(-5,16,3,green);this.rect(2,13,7,2,'#e3e3d3');this.rect(2,18,7,2,'#e3e3d3');
        this.line(-18,32,23,30,4,'#666e7d');this.rect(-3,28,9,7,'#f0c28b');
        this.ellipse(1,-37,45,44,ink);this.ellipse(1,-38,40,39,cream);this.ellipse(5,-34,35,32,'#c4d7c9');
        this.ellipse(7,-36,31,28,ink);this.ellipse(8,-38,27,24,'#2b3950',1,50,'#192132');
        this.ellipse(3,-48,19,9,'#8aabc1',.12);this.capsule(-10,-52,1,-57,4,'#d9e7e7',.72);this.circle(9,-58,2,'#d9e7e7',.5);
        this.ellipse(4,-33,3,4,green);this.ellipse(19,-34,3,4,green);this.ring(12,-26,5,3,1.4,green,.8,0,Math.PI,12);
        this.circle(-37,-34,10,ink);this.circle(-37,-34,6,'#c7b4de');this.line(-41,-36,-36,-36,2,'#776484');
        this.circle(38,-33,7,ink);this.circle(38,-33,4,'#c7b4de');
        this.line(-21,-72,-18,-78,2,'#c7b4de');this.circle(-18,-79,3,green);
        if(boost){this.star(-47,50,6,green,.9);this.star(-68,36,4,green,.6);}
      });
    }
    tnt(x,y,scale,time,alpha=1){this.transform(x,y,Math.sin(time)*.13,scale,()=>{this.rect(-19,-20,38,40,ink,alpha);this.rect(-16,-17,32,34,'#ed857c',alpha);this.rect(-12,-17,7,34,'#faab93',alpha);this.rect(8,-17,5,34,'#c46167',alpha);this.rect(-19,-9,38,4,'#523a47',alpha);this.rect(-19,9,38,4,'#523a47',alpha);this.rect(-18,-6,36,15,'#f4e5ce',alpha);this.text('TNT',0,-5,15,ink,alpha);this.line(0,-19,4,-27,3,'#d3b691',alpha);this.star(4,-29,4,'#ffce82',alpha);});}
    bean(x,y,scale,angle=0){this.transform(x,y,angle,scale,()=>{this.ellipse(0,0,17,12,ink);this.ellipse(0,-1,14,9,'#e8ac83');this.ellipse(4,-2,9,7,'#f4c5a0');this.ring(0,-5,7,7,2,'#b8775f',1,.3,2.2,18);});}
    drone(e,time){this.transform(e.x,e.y,Math.sin(e.age)*.1,e.kind==='baby'?.7:1,()=>{if(e.kind==='baby'){this.ellipse(-8,-24,22,9,'#d4d9e9',.5);this.ellipse(16,-25,22,9,'#d4d9e9',.5);this.ellipse(0,0,26,18,ink);this.ellipse(0,0,22,14,'#e1b66e');this.rect(-3,-13,8,26,ink);this.polygon([[-21,-7],[-39,0],[-21,7]],'#ded9cc');}else{this.ellipse(0,4,35,18,ink);this.ellipse(0,3,30,13,'#8b83aa');this.ellipse(0,-6,21,18,ink);this.ellipse(0,-8,16,13,'#b6a1ed');this.ellipse(0,8,21,6,'#35384f');this.circle(-18,5,3,'#ffb37d');this.circle(18,5,3,'#ffb37d');}this.rect(-12,-9,9,5,e.stun>0?green:'#fa938e');this.rect(4,-9,9,5,e.stun>0?green:'#fa938e');});if(e.stun>0)this.stunStars(e.x,e.y-36,35,time);}
    stunStars(x,y,r,time){for(let i=0;i<3;i++){const a=time*3+i*TAU/3;this.star(x+Math.cos(a)*r,y+Math.sin(a)*9,6,green);}}
    serpent(b,time){
      const points=[];for(let i=0;i<19;i++){const t=i/18;points.push({x:b.x+t*250+Math.sin(t*8+b.age*2)*35,y:b.y+Math.sin(t*TAU+b.age*1.8)*68+t*40,r:51*(1-t*.81)});}
      for(let i=points.length-1;i>=0;i--){const p=points[i];this.circle(p.x,p.y,p.r+4,ink);this.circle(p.x,p.y,p.r,i%2?'#91b981':'#b4d293');this.ellipse(p.x-4,p.y+p.r*.27,p.r*.85,p.r*.48,'#cfddac',.75);if(i%2===0)this.polygon([[p.x-10,p.y-p.r+6],[p.x+2,p.y-p.r-22],[p.x+14,p.y-p.r+6]],'#b2a1dc');this.ring(p.x,p.y,p.r*.6,p.r*.7,2,'#547a71',.35,Math.PI,Math.PI*1.6,20);}
      this.transform(b.x-32,b.y,Math.sin(time)*.07,1,()=>{this.ellipse(0,0,72,53,ink);this.ellipse(0,-2,66,47,'#b1d18d');this.ellipse(-22,16,44,24,'#d9e3ac');this.ellipse(-12,-19,19,21,ink);this.ellipse(-11,-20,15,17,'#f4e3b6');this.ellipse(-17,-18,6,10,b.stun>0?green:'#273043');this.line(-30,-36,2,-30,7,'#779574');this.circle(-55,7,4,'#537564');this.line(-60,24,-16,24,3,'#50685f');this.polygon([[-43,25],[-35,25],[-39,37]],cream);this.polygon([[-19,23],[-12,21],[-13,34]],cream);this.polygon([[14,-38],[35,-76],[39,-29]],'#b4a0d9');this.polygon([[34,-24],[67,-44],[56,0]],'#b4a0d9');});
      if(b.stun>0)this.stunStars(b.x-35,b.y-90,65,time);
    }
    wasp(b,time){
      this.transform(b.x,b.y,b.attack==='charge'?b.angle-Math.PI:Math.sin(time*2)*.08,1,()=>{
        const flap=Math.sin(time*36)*.2;
        this.transform(0,-28,-.6+flap,1,()=>{this.ellipse(25,-32,35,78,ink,.7);this.ellipse(25,-32,30,72,'#c9cde5',.7);this.line(2,17,39,-86,2,'#8895b8',.7);});
        this.transform(18,-20,.8-flap,1,()=>{this.ellipse(20,-36,32,72,ink,.7);this.ellipse(20,-36,27,67,'#c9cde5',.6);this.line(2,8,29,-94,2,'#8895b8',.7);});
        for(let i=0;i<3;i++){this.line(i*26-16,22,i*28-25,58,7,ink);this.line(i*28-25,58,i*31-42,71,6,'#b0a0bd');}
        this.polygon([[50,-10],[123,18],[51,26]],ink);this.polygon([[58,-6],[111,17],[57,21]],'#c8c8cd');
        this.ellipse(22,6,71,45,ink);this.ellipse(22,3,65,39,'#e4b667');for(let i=0;i<3;i++)this.ellipse(i*27-5,3,8,37,ink,.85);
        this.ellipse(-48,-5,40,36,ink);this.ellipse(-49,-7,34,30,'#aaa2b8');this.ellipse(-62,-10,14,16,b.stun>0?green:b.phase>1?'#ff8686':'#ffb271');this.ellipse(-34,-11,9,13,b.stun>0?green:b.phase>1?'#ff8686':'#ffb271');
        this.line(-71,-33,-84,-55,5,ink);this.line(-41,-37,-33,-60,5,ink);this.circle(-84,-57,6,'#e9b975');this.circle(-33,-62,6,'#e9b975');
        this.polygon([[-67,19],[-78,35],[-53,27]],'#eae0c7');this.polygon([[-36,21],[-30,34],[-50,26]],'#eae0c7');this.rect(-61,9,26,7,ink);
      });if(b.stun>0)this.stunStars(b.x,b.y-125,65,time);
    }
    golem(b,time,game){const shield=b.satellites.some(s=>s.hp>0);this.transform(b.x,b.y,Math.sin(time*.7)*.05,1,()=>{this.polygon([[-62,-54],[-25,-92],[44,-72],[83,-18],[59,64],[10,86],[-69,51],[-88,-7]],ink);this.polygon([[-57,-50],[-23,-85],[40,-66],[75,-16],[53,58],[10,77],[-63,47],[-80,-7]],'#8c83a0');this.polygon([[-57,-50],[-23,-85],[10,-35],[-28,11],[-80,-7]],'#b1a0ba');this.polygon([[10,-35],[40,-66],[75,-16],[53,58],[10,77],[-8,25]],'#68667e');this.line(-40,-24,-16,-19,8,shield?'#b5a0e3':'#ffb17b');this.line(17,-18,43,-26,8,shield?'#b5a0e3':'#ffb17b');this.circle(0,25,24,ink);this.circle(0,25,17,shield?'#827898':'#ffc477');this.star(0,25,12,shield?'#b6a1ed':'#fff0b9');this.polygon([[-75,10],[-112,-7],[-133,24],[-105,60],[-72,46]],'#9a89a4');this.polygon([[75,8],[112,-9],[133,24],[105,60],[72,46]],'#9a89a4');});if(shield)this.ring(b.x,b.y,113,113,3,'#b6a1ed',.25+.15*Math.sin(time*3));for(const t of game.satelliteTargets())if(t.ref.hp>0){this.circle(t.x,t.y,29,ink);this.circle(t.x,t.y,24,'#897aa6');this.circle(t.x,t.y,15,'#c3a8e9');this.star(t.x,t.y,11,'#e4d5f4');this.ring(t.x,t.y,36,36,1,'#b6a1ed',.35);}if(b.stun>0)this.stunStars(b.x,b.y-113,65,time);}
    render(game,dt){
      const gl=this.gl,time=game.time,menu=game.mode==='menu',w=this.w,h=this.h;
      if(game.active)this.scroll+=dt*(game.player.boosting?4:1);
      gl.disable(gl.BLEND);gl.useProgram(this.background);gl.bindBuffer(gl.ARRAY_BUFFER,this.bgBuffer);gl.enableVertexAttribArray(this.bgLocations.p);gl.vertexAttribPointer(this.bgLocations.p,2,gl.FLOAT,false,0,0);gl.uniform2f(this.bgLocations.resolution,this.canvas.width,this.canvas.height);gl.uniform1f(this.bgLocations.time,time);gl.uniform1f(this.bgLocations.scroll,this.scroll);gl.drawArrays(gl.TRIANGLES,0,6);
      this.count=0;this.matrix=[1,0,0,1,0,0];
      if(menu)this.drawMenu(time);else this.drawGame(game,time);
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices.subarray(0,this.count),gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.locations.p);gl.vertexAttribPointer(this.locations.p,2,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(this.locations.c);gl.vertexAttribPointer(this.locations.c,4,gl.FLOAT,false,32,8);gl.enableVertexAttribArray(this.locations.uv);gl.vertexAttribPointer(this.locations.uv,2,gl.FLOAT,false,32,24);gl.uniform2f(this.locations.world,w,h);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.atlas);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,this.count/8);
    }
    drawMenu(time){const w=this.w,h=this.h,mobile=h>w*1.2;
      this.transform(w*.74,h*.45,-.42,1,()=>{this.ring(0,0,365,210,1,'#8c8ba9',.13);this.ring(0,0,444,262,1,'#8c8ba9',.08);});
      this.planet(w*.93,h*.03,152,4,time);this.planet(w*.97,h*.72,mobile?170:125,1,time);this.planet(w*.49,h*.17,28,3,time);
      for(const [x,y,r] of [[.56,.32,7],[.88,.4,9],[.57,.64,5],[.8,.14,5],[.95,.48,4],[.44,.73,7],[.72,.7,6]])this.star(w*x,h*y,r,'#d4ccbc',.5+.2*Math.sin(time+x*20));
      const px=w*(mobile?.8:.707),py=h*(mobile?.49:.435),sc=mobile?1.75:2.6;
      for(let i=13;i>=0;i--){const phase=(time*.55+i*.1)%1,xx=px-65-i*11-phase*35,yy=py+95+i*8+Math.sin(i*2+time)*9;this.circle(xx,yy,(20+i*3)*sc*.6,i%3?'#98b166':'#bfce89',(.16+(14-i)*.012)*(1-phase*.35),36);}
      this.astronaut(px+Math.sin(time*.8)*8,py+Math.sin(time*1.3)*12,-.36+Math.sin(time*.8)*.04,sc,time,true);
      this.bean(w*.53,h*.37,1.2,time*.25-.5);this.bean(w*.86,h*.58,.8,-time*.2);this.bean(w*.65,h*.7,.65,time*.1);
      this.tnt(w*.89,h*.3,.64,time*.5,.75);
      this.transform(w*.555,h*.58,-.3,1,()=>{this.text('pffft!',0,0,22,green,.4);});
      if(mobile)this.rect(0,h*.15,w*.54,h*.59,ink,.28);
    }
    drawGame(game,time){const w=this.w,h=this.h,p=game.player;
      const orbit=game.mode==='dock',target=orbit?game.stage:Math.min(game.stage+1,4);
      const r=orbit?170:65+game.progress*100;
      this.planet(orbit?w*.8:w*.95+110-game.progress*80,h*.5,r,target,time);
      this.transform(w*.8,h*.5,-.3,1,()=>this.ring(0,0,r*1.8,r*1.05,1,'#c1b8d8',.1));
      if(!orbit){this.planet(-65-game.progress*160,h*.78,135,game.stage,time);this.text(game.target.name.toUpperCase(),w*.9,h*.5+r+40,14,'#c3bed3',.3);}
      for(let i=0;i<14;i++){const xx=((i*281+170-this.scroll*30*(1+(i%3)*.2))%(w+200)+(w+200))%(w+200)-100,yy=h*(.22+((i*17)%67)/100);this.circle(xx,yy,2+(i%3),'#8f92a8',.2);}
      if(game.boss?.kind===2&&game.boss.stun<=0){const b=game.boss;if(['windup','laser-warn','laser'].includes(b.attack)){const length=w*1.8,ex=b.x+Math.cos(b.angle)*length,ey=b.y+Math.sin(b.angle)*length;this.line(b.x,b.y,ex,ey,b.attack==='laser'?35:3,b.attack==='windup'?'#ffd48c':'#ff797f',b.attack==='laser'?.55:.4);if(b.attack==='laser')this.line(b.x,b.y,ex,ey,9,'#fff1d6',.9);}}
      for(const r of game.rings)this.ring(r.x,r.y,r.r,r.r,2.5,r.color,r.life/r.maxLife*.5,0,TAU,60);
      for(const item of game.pickups){const bob=Math.sin(time*2+item.age)*5,alpha=Math.min(1,item.life/2);this.ring(item.x,item.y+bob,item.r+12,item.r+12,1,item.kind==='tnt'?'#ffaf7b':green,.16*alpha);if(item.kind==='tnt')this.tnt(item.x,item.y+bob,.83,time+item.x,alpha);else if(item.kind==='coin'){this.circle(item.x,item.y+bob,13,'#e2b06d',alpha);this.star(item.x,item.y+bob,9,'#fff0b8',alpha);}else{this.circle(item.x,item.y+bob,15,'#b6a1ed',alpha*.2);this.rect(item.x-3,item.y+bob-10,6,20,'#c5b2f2',alpha);this.rect(item.x-10,item.y+bob-3,20,6,'#c5b2f2',alpha);}}
      for(const particle of game.particles)this.circle(particle.x,particle.y,particle.r,particle.color,particle.life/particle.maxLife*(particle.gas?.3:.8),particle.gas?24:12);
      for(const e of game.enemies)this.drone(e,time);
      if(game.boss){if(game.boss.kind===1)this.serpent(game.boss,time);else if(game.boss.kind===2)this.wasp(game.boss,time);else this.golem(game.boss,time,game);}
      for(const s of game.shots){if(s.kind==='tnt')this.tnt(s.x,s.y,.67,time*8);else{const c=s.owner==='player'?green:s.kind==='solar'?'#ffb079':s.kind==='gravity'?'#b6a1ed':'#fa8f9c';this.circle(s.x,s.y,s.r*2.2,c,.09,18);this.circle(s.x,s.y,s.r,c,1,18);this.circle(s.x-2,s.y-2,s.r*.4,'#fff0d1',.6,12);}}
      if(orbit)this.astronaut(w*.8,h*.53,-.2,1.35,time);
      else if(game.mode!=='won'||Math.sin(time*12)>-.8)this.astronaut(p.x,p.y,p.angle,.71,time,p.boosting,p.invincible>0&&Math.sin(time*20)>0);
      for(const f of game.floaters)this.text(f.text,f.x,f.y,16,f.color,Math.min(1,f.life*2));
      if(game.active&&p.gas<15){this.ring(p.x,p.y,65,65,2,'#ffaf7b',.3+.2*Math.sin(time*6));if(p.gas<1)this.text('B = FREE BEANS',p.x,p.y+68,14,'#ffaf7b');}
    }
  }
  window.SpaceRenderer=SpaceRenderer;
})();
