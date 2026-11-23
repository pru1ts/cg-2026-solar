/* 6주차 실습 1 시작 코드. TODO 1~5를 직접 작성하여 완성하세요.
 * 비교 예제 d06-materials.js는 정답을 확인하는 참고 자료입니다.
 * Copilot에 각 TODO와 week06.md 수식을 읽히고 코드를 제안받아도 됩니다.
 * 각 단계에서 무엇이 왜 달라졌는지 직접 화면으로 검증하세요.
 */
(() => {
'use strict';
const cv=document.querySelector('#cv'), gl=D.context(cv); if(!gl)return;
const VS=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;

uniform mat4 uVP;
uniform float uRotation;
uniform float uScale;
uniform vec3 uOffset;

out vec3 vP,vN,vLocal;
out vec2 vUV;

void main(){
 float c = cos(uRotation);
 float s = sin(uRotation);

 mat3 rotY = mat3(
   c, 0.0, s,
   0.0, 1.0, 0.0,
   -s, 0.0, c
 );

vec3 p = rotY * (aPos * uScale) + uOffset;
vLocal = aPos;

 vP = p;
 vN = normalize(rotY * aNormal);
 vUV = aUV;

 gl_Position = uVP * vec4(p, 1.0);
}`;
const FS=`#version 300 es
precision highp float;
const float PI=3.14159265;
in vec3 vP,vN,vLocal;
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uColor,uNormal,uARM,uEnv;
uniform vec3 uEye,uLight,uTint;
uniform bool uEmissive;
uniform vec3 uEmissiveColor;
uniform float uRough,uMetal,uNormalStrength,uPower,uAmbient,uEnvPower;
uniform float uDistance;
uniform float uVolcano;
uniform float uMaskStrength;
uniform int uViewMode;

vec3 srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
vec3 linearToSrgb(vec3 c){
 return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}

// TODO 2: D(GGX), F(Schlick), G(Smith-Schlick)를 계산해
// 직접광 PBR 결과를 반환하세요. 6주차 3-2절을 참고하세요.
vec3 directPBR(vec3 N,vec3 V,vec3 L,vec3 base,float rough,float metal){
    vec3 H = normalize(V + L);

    float nl = max(dot(N, L), 0.0);
    float nv = max(dot(N, V), 0.0);
    float nh = max(dot(N, H), 0.0);
    float vh = max(dot(V, H), 0.0);

    float a = rough * rough;
    float a2 = a * a;

    float den = nh * nh * (a2 - 1.0) + 1.0;
    float D = a2 / max(PI * den * den, 0.000001);

    float k = (rough + 1.0) * (rough + 1.0) / 8.0;
    float G = (nl / (nl * (1.0 - k) + k))
            * (nv / (nv * (1.0 - k) + k));

    vec3 F0 = mix(vec3(0.04), base, metal);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - vh, 5.0);

    vec3 kd = (1.0 - F) * (1.0 - metal);

    return (kd * base / PI
          + D * G * F / max(4.0 * nl * nv, 0.0001))
          * nl * uPower;
}

// 3D 랜덤 좌표 생성
vec3 hash3(vec3 p) {
    p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );

    return fract(sin(p) * 43758.5453);
}

// 3D 보로노이 경계선 계산
float voronoiEdge(vec3 p) {
    vec3 cell = floor(p);
    vec3 f = fract(p);

    float d1 = 1e10;
    float d2 = 1e10;

    for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec3 g = vec3(float(x), float(y), float(z));
                vec3 feature = g + hash3(cell + g) - f;

                float d = dot(feature, feature);

                if (d < d1) {
                    d2 = d1;
                    d1 = d;
                } else if (d < d2) {
                    d2 = d;
                }
            }
        }
    }

    return sqrt(d2) - sqrt(d1);
}

void main(){
 if(uEmissive){
   outColor=vec4(linearToSrgb(uEmissiveColor),1.0);
   return;
 }

 vec3 N=normalize(vN),V=normalize(uEye-vP),L=normalize(uLight);
 // TODO 1: texture(uColor,vUV).rgb를 읽어 선형화하고 base에 사용하세요.
 // 수치 맵에는 sRGB 변환을 적용하지 마세요.
 vec3 base=uTint;
 base = srgbToLinear(texture(uColor, vUV).rgb) * uTint;


 // TODO 3: uARM의 R(AO), G(roughness), B(metallic)를 읽으세요.
 // 슬라이더 uRough/uMetal은 맵 값에 곱하는 배율입니다.
 float rough=uRough,metal=uMetal,ao=1.0;
 vec3 arm = texture(uARM, vUV).rgb;
ao = arm.r;
 rough = clamp(arm.g * uRough, 0.045, 1.0);
 metal = arm.b * uMetal;

 // 첫 번째 마스크: 항성과의 거리에 따른 극지방 얼음
vec3 localDir = normalize(vLocal);

// 거리가 멀수록 얼음 영역이 넓어짐
float iceThreshold = mix(0.92, 0.22, uDistance);

float iceMask = smoothstep(
    iceThreshold - 0.08,
    iceThreshold + 0.08,
    abs(localDir.y)
);
iceMask *= uMaskStrength;

// 얼음 표면 색상
vec3 iceColor = vec3(0.48, 0.78, 0.92);

// 마스크에 따라 표면 색상과 거칠기 변화
base = mix(base, iceColor, iceMask * 0.9);
rough = mix(rough, 0.16, iceMask * 0.9);

// 두 번째 마스크: 극저온 화산 균열

float crackScale = mix(3.5, 8.0, uVolcano);
float crackWidth = mix(0.004, 0.018, uVolcano);

// 구형 행성의 로컬 좌표에서 균열 계산
float crackEdge = voronoiEdge(localDir * crackScale);

// 균열 영역 계산
float crackActivity = smoothstep(0.01, 0.12, uVolcano);
float crackMask =
    (1.0 - smoothstep(
        crackWidth,
        crackWidth + 0.025,
        crackEdge
    )) * crackActivity;

        crackMask *= uMaskStrength;

// 균열의 색상과 재질 변화
vec3 crackColor = vec3(0.025, 0.22, 0.30);

base = mix(base, crackColor, crackMask * 0.9);

// 균열 영역은 상대적으로 거친 표면
rough = mix(rough, 0.78, crackMask);

// 균열 영역의 금속성 감소
metal = mix(metal, 0.08, crackMask);

// 마스크 진단 화면
// 0: 일반 PBR
// 1: 얼음 마스크
// 2: 화산 균열 마스크

if (uViewMode == 1) {
    outColor = vec4(
        linearToSrgb(vec3(iceMask)),
        1.0
    );
    return;
}

if (uViewMode == 2) {
    outColor = vec4(
        linearToSrgb(vec3(crackMask)),
        1.0
    );
    return;
}

 // TODO 4: uNormal에서 접선 공간 법선을 읽고 N을 바꾸세요.
 // vP와 vUV의 dFdx/dFdy로 TBN을 만들어도 됩니다.
 // uNormalStrength=0이면 기하 법선을 그대로 사용하세요.

 if (uNormalStrength > 0.0) {
  vec3 dp1=dFdx(vP), dp2=dFdy(vP);
  vec2 du1=dFdx(vUV), du2=dFdy(vUV);
  vec3 T=cross(dp2,N)*du1.x+cross(N,dp1)*du2.x;
  vec3 B=cross(dp2,N)*du1.y+cross(N,dp1)*du2.y;
  float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-8));
  vec3 mapN=texture(uNormal,vUV).xyz*2.0-1.0;
  mapN.xy *= uNormalStrength;
  N=normalize(mat3(T*inv,B*inv,N)*normalize(mapN));
}


 vec3 color = directPBR(N, V, L, base, rough, metal);
 vec3 F0 = mix(vec3(0.04), base, metal);
 color += uAmbient * ao * (base * (1.0 - metal) * (1.0 - F0) + F0);
 // TODO 2: 위의 Phong 두 줄을 directPBR(...) 호출과 ambient로 교체하세요.
 // 환경맵을 끄고 uAmbient=0일 때 직접광만 비교해 보세요.

 // TODO 5: 환경 파노라마를 reflect(-V,N) 방향으로 조회해 반사를 더하세요.
 // 금속에서 정반사색은 base, 유전체의 정면 반사율은 약 0.04입니다.
 // 이미지 밝기 uEnvPower와 상수 ambient uAmbient는 별개로 유지하세요.

 vec3 reflected = reflect(-V,N);
vec2 envUV = vec2(atan(reflected.z,reflected.x)/(2.0*PI)+0.5,
                  asin(clamp(reflected.y,-1.0,1.0))/PI+0.5);
vec3 envColor = srgbToLinear(textureLod(uEnv,envUV,rough*7.0).rgb);
vec3 envF0 = mix(vec3(0.04),base,metal);
color += uEnvPower * ao * envColor * envF0;


 color=max(color,vec3(0.0));
 color=color/(1.0+color); // HDR → 표시 범위
 outColor=vec4(linearToSrgb(color),1.0);
}`;
const prog=D.program(gl,VS,FS),U=D.uniforms(gl,prog,[
 'uVP','uRotation','uScale', 'uOffset','uEye','uLight','uTint','uRough','uMetal','uNormalStrength','uPower','uAmbient','uEnvPower','uEmissive', 'uDistance','uVolcano', 'uViewMode','uMaskStrength','uEmissiveColor',
 'uColor','uNormal','uARM','uEnv'
]);
function makeSphere(seg, radius) {
  const pos = [];
  const nrm = [];
  const uv = [];
  const idx = [];

  for (let i = 0; i <= seg; i++) {
    const phi = Math.PI * i / seg;

    for (let j = 0; j <= seg * 2; j++) {
      const theta = 2.0 * Math.PI * j / (seg * 2);

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      pos.push(radius * x, radius * y, radius * z);
      nrm.push(x, y, z);
      uv.push(j / (seg * 2), 1.0 - i / seg);
    }
  }

  const W = seg * 2 + 1;

  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg * 2; j++) {
      const a = i * W + j;
      const b = a + W;

      idx.push(a, b, a + 1);
      idx.push(a + 1, b, b + 1);
    }
  }

  return {
    pos: new Float32Array(pos),
    nrm: new Float32Array(nrm),
    uv: new Float32Array(uv),
    idx: new Uint16Array(idx)
  };
}
const mesh = D.upload(gl, makeSphere(48, 1.15));
const assets={wood_planks:['Diffuse','nor_gl','arm'],rusty_metal_04:['Diffuse','nor_gl','arm'],rock_boulder_dry:['Diffuse','nor_gl','arm']};
const textures={},jobs=[];let failed=false;
function load(name){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 jobs.push(new Promise(resolve=>{const img=new Image();img.onload=()=>{
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);

  resolve();
 };img.onerror=()=>{failed=true;resolve();};
 img.src='assets/week06/'+name+(name.endsWith('_arm')?'.png':'.jpg');}));
 return tex;
}
for(const [asset,kinds] of Object.entries(assets))textures[asset]=kinds.map(kind=>load(asset+'_'+kind));
const envTex=load('studio_small_09_tonemapped');
Promise.all(jobs).then(()=>{document.querySelector('#status').textContent=failed?'텍스처 로딩 실패: HTTP 서버와 파일 경로 확인':'텍스처 로딩 완료 · task1.js의 TODO 1부터 작성하세요';});
document.querySelector('#ui').innerHTML='';
const S=D.UI('#ui',[
 {id:'material',type:'select',label:'재질 선택',value:'rock_boulder_dry',options:[ 
  {value:'rusty_metal_04',label:'녹슨 금속'},{value:'wood_planks',label:'나무'},{value:'rock_boulder_dry',label:'돌'}]},
 {id:'rough',label:'roughness 배율',min:.05,max:1,step:.01,value:1},
 {id:'metal',label:'metallic 배율',min:0,max:1,step:.01,value:1},
 {id:'normal',label:'normal 강도',min:0,max:10,step:.1,value:5},
 {id:'power',label:'직접광 세기',min:0,max:8,step:.1,value:4},
 {id:'ambient',label:'상수 ambient',min:0,max:1,step:.01,value:.15},
 {
    id:'display',
    type:'select',
    label:'화면 보기',
    value:'surface',
    options:[
        {value:'compare',label:'기본 / 변화 비교'},
        {value:'surface',label:'PBR 전체 표면'},
        {value:'mask1',label:'마스크 1 · 얼음'},
        {value:'mask2',label:'마스크 2 · 균열'}
    ]
},
 {id:'env',label:'환경맵 반사 세기',min:0,max:3,step:.1,value:1.5},
 {id:'distance',label:'항성과의 거리',min:0,max:100,step:1,value:50},
 {
  id:'volcano',
  label:'극저온 화산 활동',
  min:0,
  max:100,
  step:1,
  value:35
},
]);

const cam=D.orbit(cv,{dist:4.6,pitch:.15});document.querySelector('#reset').onclick=()=>{cam.dist=4.6;cam.yaw=0;cam.pitch=.15;};
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create();
document.querySelector('#note').textContent='실습 2: 태양과 행성의 표면 환경 변화를 구현합니다.';
let visible=true;new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(cv);
D.loop(()=>{
 if(!visible||document.hidden)return;
 D.fit(cv);gl.viewport(0,0,cv.width,cv.height);D.clearColor(gl);gl.enable(gl.DEPTH_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const eye=cam.eye([0,0,0]);D.M4.lookAt(view,eye,[0,0,0],[0,1,0]);D.M4.perspective(proj,Math.PI/4,cv.width/cv.height,.1,100);D.M4.multiply(vp,proj,view);
 gl.useProgram(prog);

 gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform3fv(U.uEye,eye);
 gl.uniform1f(U.uScale, 1.0);
 gl.uniform3f(U.uOffset, 0.0, 0.0, 0.0);
 gl.uniform3fv(U.uLight,[.6,.7,1.]);gl.uniform3fv(U.uTint,[.6,.6,.6]);
 for(const [key,value] of Object.entries({uDistance: Number(S.distance) / 100, uVolcano: Number(S.volcano) / 100, uRough:S.rough,uMetal:S.metal,uNormalStrength:S.normal,uPower:S.power,uAmbient:S.ambient,uEnvPower:S.env}))gl.uniform1f(U[key],value);
 [...textures[S.material],envTex].forEach((tex,i)=>{
  gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.uniform1i(U[['uColor','uNormal','uARM','uEnv'][i]],i);
 });
 gl.bindVertexArray(mesh.vao);

 // 태양의 위치
const distanceValue = Number(S.distance);
const sunDistance = 1.7 + (distanceValue / 100) * 1.2;

const sunPosition = [-sunDistance, 0.35, 0.0];

// 행성에서 태양을 향하는 방향 계산
const sunLength = Math.hypot(
  sunPosition[0],
  sunPosition[1],
  sunPosition[2]
);

const sunDirection = sunPosition.map(
  value => value / sunLength
);

// 태양과 행성 사이의 거리 감쇠 (역제곱 법칙)
const referenceDistance = Math.hypot(2.9, 0.35, 0.0);

const lightAttenuation = Math.pow(
  referenceDistance / sunLength, 2.0
);

// 태양이 가까울수록 행성에 들어오는 직접광 증가
gl.uniform1f(
  U.uPower,
  S.power * lightAttenuation
);

// 1. 행성 그리기
// 현재 화면 모드
const displayMode = S.display || 'surface';

const viewMode =
    displayMode === 'mask1' ? 1 :
    displayMode === 'mask2' ? 2 : 0;

const rotation = performance.now() * 0.00025;

// ==================================================
// 비교 모드: 기본 행성 vs 변화한 행성
// ==================================================

if (displayMode === 'compare') {

    // 비교 화면에서는 동일한 조명을 사용
    gl.uniform1i(U.uViewMode, 0);
    gl.uniform1i(U.uEmissive, 0);

    gl.uniform3f(U.uLight, -1.0, 0.15, 0.0);
    gl.uniform1f(U.uPower, S.power);

    gl.uniform1f(U.uScale, 0.62);
    gl.uniform1f(U.uRotation, rotation);

    // 왼쪽: 기본 행성 (마스크 비활성화)
    gl.uniform3f(U.uOffset, -0.85, 0.0, 0.0);

    gl.uniform1f(U.uDistance, 0.0);
    gl.uniform1f(U.uVolcano, 0.0);
    gl.uniform1f(U.uMaskStrength, 0.0);

    gl.drawElements(
        gl.TRIANGLES,
        mesh.count,
        gl.UNSIGNED_SHORT,
        0
    );

    // 오른쪽: 환경 변화가 적용된 행성
    gl.uniform3f(U.uOffset, 0.85, 0.0, 0.0);

    gl.uniform1f(
        U.uDistance,
        Number(S.distance) / 100
    );

    gl.uniform1f(
        U.uVolcano,
        Number(S.volcano) / 100
    );

    gl.uniform1f(U.uMaskStrength, 1.0);

    gl.drawElements(
        gl.TRIANGLES,
        mesh.count,
        gl.UNSIGNED_SHORT,
        0
    );

    // 비교 화면용 태양
    gl.uniform1i(U.uEmissive, 1);

    gl.uniform3f(
        U.uEmissiveColor,
        1.0, 0.45, 0.08
    );

    gl.uniform1f(U.uScale, 0.28);
    gl.uniform3f(U.uOffset, -2.2, 0.35, 0.0);

    gl.drawElements(
        gl.TRIANGLES,
        mesh.count,
        gl.UNSIGNED_SHORT,
        0
    );

}

// ==================================================
// 일반 표면 / 마스크 진단 모드
// ==================================================

else {

    gl.uniform1i(U.uViewMode, viewMode);
    gl.uniform1i(U.uEmissive, 0);

    gl.uniform1f(U.uScale, 1.15);
    gl.uniform1f(U.uRotation, rotation);

    gl.uniform3f(U.uOffset, 0.0, 0.0, 0.0);

    gl.uniform1f(
        U.uDistance,
        Number(S.distance) / 100
    );

    gl.uniform1f(
        U.uVolcano,
        Number(S.volcano) / 100
    );

    gl.uniform1f(U.uMaskStrength, 1.0);

    gl.uniform3fv(U.uLight, sunDirection);

    gl.uniform1f(
        U.uPower,
        S.power * lightAttenuation
    );

    // 행성
    gl.drawElements(
        gl.TRIANGLES,
        mesh.count,
        gl.UNSIGNED_SHORT,
        0
    );

    // 태양
    gl.uniform1i(U.uEmissive, 1);

    gl.uniform3f(
        U.uEmissiveColor,
        1.0, 0.45, 0.08
    );

    gl.uniform1f(U.uScale, 0.38);
    gl.uniform3fv(U.uOffset, sunPosition);
    gl.uniform1f(U.uRotation, 0.0);

    gl.drawElements(
        gl.TRIANGLES,
        mesh.count,
        gl.UNSIGNED_SHORT,
        0
    );
}



gl.bindVertexArray(null);
});
})();
