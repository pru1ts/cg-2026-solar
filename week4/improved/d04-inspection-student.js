/* Week 04 improved interface
   - 제공 모델(d04-inspection-model.js)은 수정하지 않는다.
   - 층/옥상 바로가기 + 관찰 대상 바로가기
   - 선택한 층을 회전 중심(target)으로 사용
   - O1/O2는 과제 조건에 맞는 직교 뷰로 표시
*/
(() => {
  'use strict';
  const viewer = window.InspectionViewer;
  if (!viewer) return;

  const controls = viewer.controls;
  const ui = document.querySelector('#student-ui');

  // 카메라 preset은 모델의 실제 좌표를 기준으로 정했다.
  // target: 해당 층/대상의 중심, distance: 전체 맥락과 세부가 함께 보이는 거리,
  // fov: 일반 층은 38~42도, 작은 명판은 28~32도로 좁혀 가독성을 높인다.
  const presets = {
    overview: {label:'전체', target:[3,3,0], distance:30, fov:45, yaw:.60, pitch:-.44},
    floor1:   {label:'1층', target:[1.5,1.45,0], distance:18, fov:40, yaw:.30, pitch:-.10},
    floor2:   {label:'2층', target:[1.5,4.35,0], distance:18, fov:40, yaw:.30, pitch:-.08},
    floor3:   {label:'3층', target:[1.5,7.25,0], distance:18, fov:40, yaw:.30, pitch:-.06},
    roof:     {label:'옥상', target:[0,9.25,-.3], distance:12, fov:36, yaw:.20, pitch:-.20},
    P1: {label:'P1', target:[-2,1.6,4.12], distance:5.2, fov:32, yaw:0, pitch:0},
    P2: {label:'P2', target:[3,1.25,-2.085], distance:3.0, fov:28, yaw:0, pitch:0},
    P3: {label:'P3', target:[-3,4.05,1.315], distance:2.0, fov:28, yaw:0, pitch:0},
    P4: {label:'P4', target:[.5,9.42,-.435], distance:4.0, fov:30, yaw:0, pitch:0},
    // P5 명판은 yaw=PI라 뒤쪽(-z)에서 +z 방향으로 보아야 한다.
    P5: {label:'P5', target:[0,4.6,-4.4], distance:3.5, fov:30, yaw:Math.PI, pitch:0},
    P6: {label:'P6', target:[11,1.4,1.565], distance:2.8, fov:30, yaw:0, pitch:0}
  };

  function qmul(a,b){return [
    a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
    a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
  ];}
  function qnorm(q){const n=Math.hypot(...q)||1;return q.map(v=>v/n);}
  function rotation(yaw=0,pitch=0){
    const qy=[0,Math.sin(yaw/2),0,Math.cos(yaw/2)];
    const qx=[Math.sin(pitch/2),0,0,Math.cos(pitch/2)];
    return qnorm(qmul(qy,qx));
  }

  let mode='overview';
  function applyPreset(key){
    const p=presets[key]; if(!p)return;
    controls.state.target=[...p.target];
    controls.state.distance=p.distance;
    controls.state.fov=p.fov;
    controls.state.rotation=rotation(p.yaw,p.pitch);
    controls.state.actions++;
    mode=key;
    viewer.render=null;
    updateUI();
    viewer.canvas.focus();
  }

  function orthographic(id){
    const c=viewer.model.comparisons.find(x=>x.id===id); if(!c)return;
    mode=id;
    const dir=c.viewDirection;
    const distance=18;
    const eye=c.position.map((v,i)=>v-dir[i]*distance);
    const halfHeight=id==='O1'?3.4:3.0;
    viewer.render=v=>v.drawView({
      eye,target:[...c.position],up:[0,1,0],orthographic:true,halfHeight,near:.02,far:180
    });
    controls.state.target=[...c.position]; // 비교 대상 중심 = 회전/관찰 기준
    controls.state.fov=35;
    controls.state.actions++;
    updateUI();
  }

  ui.innerHTML=`
    <section class="student-card" aria-label="개선된 카메라 이동">
      <h2>빠른 관찰 이동</h2>
      <p class="student-help">층을 선택해 바로 이동한 뒤, 트랙패드 두 손가락 드래그로 위치를 미세 조정하세요.</p>
      <div class="floor-map" aria-label="층별 지도">
        <button data-view="roof">ROOF</button>
        <button data-view="floor3">3F</button>
        <button data-view="floor2">2F</button>
        <button data-view="floor1">1F</button>
        <button data-view="overview">OVERVIEW</button>
      </div>
      <h2 class="student-subtitle">관찰 대상</h2>
      <div class="poi-grid">
        ${['P1','P2','P3','P4','P5','P6'].map(x=>`<button data-view="${x}">${x}</button>`).join('')}
      </div>
      <div class="compare-grid">
        <button data-ortho="O1">O1 전면 직교</button>
        <button data-ortho="O2">O2 우측 직교</button>
      </div>
      <p id="view-status" class="view-status"></p>
    </section>`;

  function updateUI(){
    ui.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    const b=ui.querySelector(`[data-view="${mode}"],[data-ortho="${mode}"]`); if(b)b.classList.add('active');
    const status=ui.querySelector('#view-status');
    if(mode==='O1') status.textContent='현재: O1 · 전면 직교 · A/B를 같은 배율로 비교';
    else if(mode==='O2') status.textContent='현재: O2 · 오른쪽 측면 직교 · A/B 돌출 비교';
    else status.textContent=`현재: ${presets[mode]?.label||mode} · 회전 중심 = 선택 위치`;
  }
  ui.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    if(b.dataset.view)applyPreset(b.dataset.view);
    if(b.dataset.ortho)orthographic(b.dataset.ortho);
  });
  updateUI();

  // 기존 전체 보기 버튼도 개선 UI 상태와 동기화한다.
  document.querySelector('#home').addEventListener('click',()=>{
    mode='overview'; viewer.render=null; updateUI();
  });
})();
