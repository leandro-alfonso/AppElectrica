(() => {
  "use strict";

  const { uid, dbPut, dbGetAll, dbGet, dbDelete, readFile, escapeHtml, showError, stores } = window.Electricista;
  let currentWork = null;
  const $ = (id) => document.getElementById(id);
  const workList = $("workList");
  const emptyWorks = $("emptyWorks");
  const workModal = $("workModal");
  const workForm = $("workForm");
  const detailModal = $("detailModal");
  const detailContent = $("detailContent");

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest(".modal")?.classList.add("hidden")));
  $("newWorkBtn")?.addEventListener("click", () => openWorkForm());
  $("emptyNewBtn")?.addEventListener("click", () => openWorkForm());

  async function renderWorks() {
    try {
      const works = await dbGetAll(stores.works);
      works.sort((a, b) => (b.created || 0) - (a.created || 0));
      const allPhotos = await dbGetAll(stores.photos);
      workList.innerHTML = "";
      emptyWorks.classList.toggle("hidden", works.length > 0);
      for (const w of works) {
        const photos = allPhotos.filter((p) => p.workId === w.id);
        const card = document.createElement("article");
        card.className = "work-card";
        card.innerHTML = `
          <div class="work-cover">${photos[0] ? `<img src="${photos[0].data}" alt="">` : "📸"}</div>
          <div class="work-body">
            <span class="work-meta">${escapeHtml(w.category)} · ${new Date(w.created).toLocaleDateString("es-AR")}</span>
            <h3>${escapeHtml(w.name)}</h3>
            <p>${escapeHtml(w.description || "Sin descripción")}</p>
            <div class="work-actions"><button type="button" class="btn btn-secondary open-work">Abrir</button><button type="button" class="btn btn-danger delete-work">🗑️</button></div>
          </div>`;
        card.querySelector(".open-work").addEventListener("click", () => openDetail(w.id));
        card.querySelector(".delete-work").addEventListener("click", () => deleteWork(w.id));
        workList.appendChild(card);
      }
    } catch (error) { showError(error); }
  }

  function openWorkForm(work = null) {
    $("modalTitle").textContent = work ? "Editar trabajo" : "Nuevo trabajo";
    $("workName").value = work?.name || "";
    $("workCategory").value = work?.category || "Instalación";
    $("workDescription").value = work?.description || "";
    workForm.dataset.id = work?.id || "";
    workModal.classList.remove("hidden");
    setTimeout(() => $("workName")?.focus(), 0);
  }

  workForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const id = workForm.dataset.id || uid();
      const name = $("workName").value.trim();
      if (!name) return alert("Ingresá el nombre del trabajo.");
      const old = await dbGet(stores.works, id);
      await dbPut(stores.works, { id, name, category: $("workCategory").value, description: $("workDescription").value.trim(), created: old?.created || Date.now() });
      workModal.classList.add("hidden");
      await renderWorks();
    } catch (error) { showError(error); }
  });

  async function deleteWork(id) {
    try {
      if (!confirm("¿Eliminar este trabajo y todas sus fotos? Esta acción no se puede deshacer.")) return;
      const photos = (await dbGetAll(stores.photos)).filter((p) => p.workId === id);
      for (const p of photos) await dbDelete(stores.photos, p.id);
      await dbDelete(stores.works, id);
      detailModal.classList.add("hidden");
      await renderWorks();
    } catch (error) { showError(error); }
  }

  async function openDetail(id) {
    try {
      currentWork = await dbGet(stores.works, id);
      if (!currentWork) return alert("No se encontró el trabajo.");
      const photos = (await dbGetAll(stores.photos)).filter((p) => p.workId === id).sort((a, b) => (a.created || 0) - (b.created || 0));
      detailContent.innerHTML = `
        <div class="detail-header"><div><span class="eyebrow">${escapeHtml(currentWork.category)}</span><h2>${escapeHtml(currentWork.name)}</h2><div class="detail-description">${escapeHtml(currentWork.description || "Sin descripción")}</div></div>
        <div class="detail-tools"><button type="button" class="btn btn-secondary edit-work">✏️ Editar</button><button type="button" class="btn btn-primary add-photo">📷 Agregar foto</button><button type="button" class="btn btn-danger delete-detail">🗑️</button></div></div>
        <div class="photo-grid">${photos.map((p, i) => photoCard(p, i)).join("")}</div>`;
      detailContent.querySelector(".edit-work")?.addEventListener("click", () => { detailModal.classList.add("hidden"); openWorkForm(currentWork); });
      detailContent.querySelector(".add-photo")?.addEventListener("click", openPhotoSource);
      detailContent.querySelector(".delete-detail")?.addEventListener("click", () => deleteWork(id));
      detailContent.querySelectorAll(".delete-photo").forEach((b, i) => b.addEventListener("click", async () => { if (confirm("¿Eliminar esta foto?")) { await dbDelete(stores.photos, photos[i].id); await openDetail(id); } }));
      detailContent.querySelectorAll(".edit-photo").forEach((b, i) => b.addEventListener("click", () => openEditor(photos[i])));
      detailContent.querySelectorAll(".edit-photo-info").forEach((b, i) => b.addEventListener("click", () => editPhotoInfo(photos[i])));
      detailContent.querySelectorAll(".photo-view").forEach((b, i) => b.addEventListener("click", () => openLightbox(photos, i)));
      detailModal.classList.remove("hidden");
    } catch (error) { showError(error); }
  }

  function photoCard(p, i) {
    return `<article class="photo-card"><button type="button" class="photo-view" data-index="${i}"><img src="${p.data}" alt="${escapeHtml(p.description || "Foto de trabajo")}"></button><div class="photo-info"><strong>${escapeHtml(p.description || "Sin descripción")}</strong><small>${new Date(p.created || Date.now()).toLocaleString("es-AR")}</small></div><div class="photo-actions"><button type="button" class="edit-photo">🎨 Editar</button><button type="button" class="edit-photo-info">📝 Descripción</button><button type="button" class="delete-photo">🗑️</button></div></article>`;
  }

  async function editPhotoInfo(photo) {
    const value = prompt("Descripción de esta foto. Ej.: 'Caja 10x10 y cañería hacia cocina'", photo.description || "");
    if (value === null) return;
    await dbPut(stores.photos, { ...photo, description: value.trim() });
    await openDetail(currentWork.id);
  }

  // Inputs separados: uno abre la cámara y otro permite elegir desde la galería.
  // No usamos capture en el input de galería porque eso puede forzar la cámara en móviles.
  const cameraInput = document.createElement("input");
  cameraInput.type = "file";
  cameraInput.accept = "image/*";
  cameraInput.capture = "environment";
  cameraInput.multiple = true;
  cameraInput.hidden = true;

  const galleryInput = document.createElement("input");
  galleryInput.type = "file";
  galleryInput.accept = "image/*";
  galleryInput.multiple = true;
  galleryInput.hidden = true;

  document.body.append(cameraInput, galleryInput);

  function openPhotoSource() {
    const box = document.createElement("div");
    box.className = "photo-source-actions";
    box.innerHTML = `
      <div class="photo-source-title">¿Cómo querés agregar la foto?</div>
      <button type="button" class="btn btn-primary source-camera">📷 Sacar foto</button>
      <button type="button" class="btn btn-secondary source-gallery">🖼️ Elegir de galería</button>`;
    document.body.appendChild(box);

    box.querySelector(".source-camera").onclick = () => { box.remove(); cameraInput.click(); };
    box.querySelector(".source-gallery").onclick = () => { box.remove(); galleryInput.click(); };
  }

  async function processPhotos(input) {
    try {
      if (!input.files.length || !currentWork) return;
      for (const file of [...input.files]) {
        const data = await readFile(file);
        const description = prompt(`Descripción de la foto "${file.name}"`, "");
        await dbPut(stores.photos, { id: uid(), workId: currentWork.id, data, original: data, description: description || "", objects: [], created: Date.now() });
      }
      input.value = "";
      await openDetail(currentWork.id);
      await renderWorks();
    } catch (error) { showError(error); }
  }

  cameraInput.addEventListener("change", () => processPhotos(cameraInput));
  galleryInput.addEventListener("change", () => processPhotos(galleryInput));

  // Símbolos eléctricos incluidos en img/iconos/.
  // Están normalizados a 512x512 WebP para celular y PC.
  const DEFAULT_SYMBOLS = [
    ["toma", "🔌", "img/iconos/TomaSimple.webp"],
    ["toma doble", "⏺️", "img/iconos/TomaDoble.webp"],
    ["toma 20A", "🔌", "img/iconos/Toma20A.webp"],
    ["punto simple", "🔘", "img/iconos/PuntoSimple.webp"],
    ["punto doble", "◉", "img/iconos/PuntoDoble.webp"],
    ["punto y toma", "🔘", "img/iconos/PuntoToma.webp"],
    ["3 puntos", "◉", "img/iconos/3puntos.webp"],
    ["caja estanco", "▣", "img/iconos/CajaEstanco.webp"],
    ["caja octagonal", "▣", "img/iconos/CajaOctagonal.webp"],
    ["tablero", "▤", "img/iconos/TableroTermica.webp"],
    ["térmica 10A", "⚡", "img/iconos/Termica10A.webp"],
    ["térmica 15A", "⚡", "img/iconos/Termica15A.webp"],
    ["térmica 20A", "⚡", "img/iconos/Termica20A.webp"],
    ["disyuntor 40A", "◈", "img/iconos/Disyuntor40A.webp"]
  ];
  const getCustomSymbols = () => JSON.parse(localStorage.getItem("electricista_custom_symbols") || "[]");
  const saveCustomSymbols = (x) => localStorage.setItem("electricista_custom_symbols", JSON.stringify(x));

  async function openEditor(photo) {
    let tool = "select";
    let objects = JSON.parse(JSON.stringify(photo.objects || []));
    let selected = -1;
    let drag = null;
    let history = [];
    let previewObject = null;
    let baseImg = new Image();

    const modal = document.createElement("div");
    modal.className = "modal editor-modal";
    modal.innerHTML = `<div class="modal-box editor-box">
      <button type="button" class="modal-close">×</button><h2>Editor de foto</h2>
      <div class="editor-toolbar">
        <button data-tool="select">↖ Seleccionar</button><button data-tool="pen">🖊️ Cable / lápiz</button><button data-tool="arrow">➡️ Flecha</button><button data-tool="rect">▭ Caja</button><button data-tool="circle">⭕ Círculo</button><button id="textTool">🔤 Texto</button><button id="symbolTool">🧩 Símbolos</button><button id="undoTool">↩️ Deshacer</button><button id="clearTool">🧹 Limpiar</button>
      </div>
      <div class="editor-options"><label>Color <input id="lineColor" type="color" value="#ff2020"></label><label>Grosor <input id="lineWidth" type="range" min="2" max="20" value="5"><output id="widthOut">5 px</output></label><label>Tamaño seleccionado <input id="objectSize" type="range" min="20" max="240" value="70"><output id="sizeOut">70</output></label><button id="rotateLeft">↶ -15°</button><button id="rotateRight">↷ +15°</button><button id="deleteSelected">🗑️ Quitar seleccionado</button></div>
      <div id="symbolPanel" class="symbol-panel hidden"></div>
      <div class="editor-help">Seleccioná un elemento para moverlo. Usá el punto superior para girarlo y las esquinas para cambiar su tamaño. En flechas y cajas vas a ver la forma mientras la dibujás.</div>
      <div class="editor-area"><div class="editor-canvas-wrap"><img id="editorImage"><canvas class="editor-canvas"></canvas></div></div>
      <div class="form-actions"><button type="button" class="btn btn-secondary cancel-edit">Cancelar</button><button type="button" class="btn btn-primary save-edit">💾 Guardar anotación</button></div>
    </div>`;
    document.body.appendChild(modal); modal.classList.remove("hidden");

    const img = modal.querySelector("#editorImage");
    const canvas = modal.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const color = modal.querySelector("#lineColor");
    const width = modal.querySelector("#lineWidth");
    const size = modal.querySelector("#objectSize");
    const widthOut = modal.querySelector("#widthOut");
    const sizeOut = modal.querySelector("#sizeOut");
    img.src = photo.original || photo.data;
    img.onload = () => { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; draw(); };

    function cloneObjects() { return JSON.parse(JSON.stringify(objects)); }
    function pushHistory() { history.push(cloneObjects()); if (history.length > 30) history.shift(); }
    function pointer(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
    function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
    function center(o){
      if(['line','arrow','rect'].includes(o.type)) return {x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2};
      if(o.type==='circle') return {x:o.x1,y:o.y1};
      if(o.type==='path'){
        const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y);
        return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
      }
      return {x:o.x,y:o.y};
    }
    function rotatePoint(p,c,deg){
      const a=deg*Math.PI/180,dx=p.x-c.x,dy=p.y-c.y,co=Math.cos(a),si=Math.sin(a);
      return {x:c.x+dx*co-dy*si,y:c.y+dx*si+dy*co};
    }
    function localPoint(p,o){
      const c=center(o); return rotatePoint(p,c,-(o.rot||0));
    }
    function bounds(o){
      if(o.type==='path'){
        const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y);
        return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
      }
      if(o.type==='rect'){
        const c=center(o), pts=[{x:o.x1,y:o.y1},{x:o.x2,y:o.y1},{x:o.x2,y:o.y2},{x:o.x1,y:o.y2}].map(p=>rotatePoint(p,c,o.rot||0));
        const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
        return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
      }
      if(o.type==='circle'){
        const r=Math.hypot(o.x2-o.x1,o.y2-o.y1);
        return {x:o.x1-r,y:o.y1-r,w:2*r,h:2*r};
      }
      if(o.type==='line'||o.type==='arrow'){
        const c=center(o),pts=[rotatePoint({x:o.x1,y:o.y1},c,o.rot||0),rotatePoint({x:o.x2,y:o.y2},c,o.rot||0)];
        return {x:Math.min(pts[0].x,pts[1].x),y:Math.min(pts[0].y,pts[1].y),w:Math.abs(pts[1].x-pts[0].x),h:Math.abs(pts[1].y-pts[0].y)};
      }
      const s=o.size||50; return {x:o.x-s/2,y:o.y-s/2,w:s,h:s};
    }
    function hit(o,p){
      const pad=Math.max(15,(o.width||5)*3);
      if(o.type==='path'){
        const q=localPoint(p,o);
        return o.points.some(pt=>dist(pt,q)<12+pad/2);
      }
      const q=localPoint(p,o);
      if(o.type==='circle'){
        const r=Math.hypot(o.x2-o.x1,o.y2-o.y1); return Math.abs(dist(q,{x:o.x1,y:o.y1})-r)<pad || dist(q,{x:o.x1,y:o.y1})<r+pad;
      }
      if(['rect','arrow','line'].includes(o.type)){
        if(o.type==='rect'){
          const minX=Math.min(o.x1,o.x2)-pad,maxX=Math.max(o.x1,o.x2)+pad,minY=Math.min(o.y1,o.y2)-pad,maxY=Math.max(o.y1,o.y2)+pad;
          return q.x>=minX&&q.x<=maxX&&q.y>=minY&&q.y<=maxY;
        }
        const ax=o.x1,ay=o.y1,bx=o.x2,by=o.y2,dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
        if(!len2)return dist(q,{x:ax,y:ay})<pad+12;
        const t=Math.max(0,Math.min(1,((q.x-ax)*dx+(q.y-ay)*dy)/len2));
        return dist(q,{x:ax+t*dx,y:ay+t*dy})<pad+10;
      }
      const s=o.size||50; return Math.abs(q.x-o.x)<s/2+pad&&Math.abs(q.y-o.y)<s/2+pad;
    }
    function drawObject(o,isPreview=false){
      ctx.save();
      ctx.strokeStyle=o.color||'#ff2020';ctx.fillStyle=o.color||'#ff2020';ctx.lineWidth=o.width||5;ctx.lineCap='round';ctx.lineJoin='round';
      const c=center(o);
      if(['path','rect','circle','arrow','line'].includes(o.type)){
        ctx.translate(c.x,c.y);ctx.rotate((o.rot||0)*Math.PI/180);ctx.translate(-c.x,-c.y);
      }
      if(o.type==='path'){
        ctx.beginPath();o.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
      }
      if(o.type==='arrow'){
        ctx.beginPath();ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();
        const a=Math.atan2(o.y2-o.y1,o.x2-o.x1);ctx.beginPath();
        ctx.moveTo(o.x2,o.y2);ctx.lineTo(o.x2-22*Math.cos(a-.5),o.y2-22*Math.sin(a-.5));
        ctx.moveTo(o.x2,o.y2);ctx.lineTo(o.x2-22*Math.cos(a+.5),o.y2-22*Math.sin(a+.5));ctx.stroke();
      }
      if(o.type==='rect')ctx.strokeRect(o.x1,o.y1,o.x2-o.x1,o.y2-o.y1);
      if(o.type==='circle'){const r=Math.hypot(o.x2-o.x1,o.y2-o.y1);ctx.beginPath();ctx.arc(o.x1,o.y1,r,0,Math.PI*2);ctx.stroke();}
      if(o.type==='line'){ctx.beginPath();ctx.moveTo(o.x1,o.y1);ctx.lineTo(o.x2,o.y2);ctx.stroke();}
      if(o.type==='text'){
        ctx.translate(o.x,o.y);ctx.rotate((o.rot||0)*Math.PI/180);ctx.font=`bold ${o.size||40}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.text,0,0);
      }
      if(o.type==='symbol'){
        ctx.translate(o.x,o.y);ctx.rotate((o.rot||0)*Math.PI/180);
        if(o.image){
          const im=getCachedImage(o.image);if(im.complete&&im.naturalWidth)ctx.drawImage(im,-o.size/2,-o.size/2,o.size,o.size);
        }else{ctx.font=`bold ${o.size||70}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.emoji||'⬡',0,0);}
        if(o.label){ctx.font=`bold ${Math.max(12,o.size/5)}px Arial`;ctx.fillText(o.label,0,o.size/2+16);}
      }
      ctx.restore();
    }
    const imageCache=new Map();
    function getCachedImage(src){
      if(!imageCache.has(src)){const im=new Image();im.onload=()=>draw();im.src=src;imageCache.set(src,im);}return imageCache.get(src);
    }
    function drawSelection(o){
      const b=bounds(o);ctx.save();ctx.strokeStyle='#007bff';ctx.setLineDash([7,5]);ctx.lineWidth=2;ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.setLineDash([]);ctx.fillStyle='#007bff';
      [[b.x-8,b.y-8],[b.x+b.w+8,b.y-8],[b.x-8,b.y+b.h+8],[b.x+b.w+8,b.y+b.h+8]].forEach(([x,y])=>ctx.fillRect(x-5,y-5,10,10));
      const c={x:b.x+b.w/2,y:b.y-38};ctx.beginPath();ctx.moveTo(b.x+b.w/2,b.y-8);ctx.lineTo(c.x,c.y);ctx.stroke();ctx.beginPath();ctx.arc(c.x,c.y,8,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);for(const o of objects)drawObject(o);if(previewObject)drawObject(previewObject,true);if(selected>=0&&objects[selected])drawSelection(objects[selected]);}

    function setTool(name){tool=name;modal.querySelectorAll("[data-tool]").forEach(x=>x.classList.toggle("active",x.dataset.tool===name));previewObject=null;draw();}
    modal.querySelectorAll("[data-tool]").forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.tool)));
    setTool("select");
    width.addEventListener("input",()=>{widthOut.value=width.value+" px";if(selected>=0){pushHistory();objects[selected].width=+width.value;draw();}});
    color.addEventListener("input",()=>{if(selected>=0){pushHistory();objects[selected].color=color.value;draw();}});
    size.addEventListener("input",()=>{sizeOut.value=size.value;if(selected>=0&&["text","symbol"].includes(objects[selected].type)){objects[selected].size=+size.value;draw();}});
    modal.querySelector("#rotateLeft").onclick=()=>rotateSelected(-15);modal.querySelector("#rotateRight").onclick=()=>rotateSelected(15);
    modal.querySelector("#deleteSelected").onclick=()=>{if(selected>=0){pushHistory();objects.splice(selected,1);selected=-1;draw();}};
    modal.querySelector("#undoTool").onclick=()=>{if(history.length){objects=history.pop();selected=-1;draw();}};
    modal.querySelector("#clearTool").onclick=()=>{if(objects.length&&confirm("¿Eliminar todas las anotaciones?")){pushHistory();objects=[];selected=-1;draw();}};

    function rotateSelected(deg){if(selected<0)return;const o=objects[selected];pushHistory();o.rot=(o.rot||0)+deg;draw();}
    modal.querySelector("#textTool").onclick=()=>{const text=prompt("Texto para colocar:","Cable 2,5 mm²");if(!text)return;pushHistory();objects.push({type:"text",text,size:40,rot:0,x:canvas.width/2,y:canvas.height/2,color:color.value});selected=objects.length-1;size.value=40;sizeOut.value="40";setTool('select');draw();};

    const panel=modal.querySelector("#symbolPanel");
    function buildSymbols(){
      const customs=getCustomSymbols();
      panel.innerHTML=DEFAULT_SYMBOLS.map(s=>`<button type="button" class="symbol-choice" data-emoji="${s[1]}" data-label="${s[0]}" data-image="${s[2]}"><img src="${s[2]}" alt="${s[0]}"><small>${s[0]}</small></button>`).join("")+
        customs.map((s,i)=>`<button type="button" class="symbol-choice" data-custom="${i}"><img src="${s.image}" alt=""><small>${escapeHtml(s.name)}</small></button>`).join("")+`<button type="button" class="symbol-choice add-symbol"><span>➕</span><small>Agregar PNG</small></button>`;
      panel.querySelectorAll("[data-emoji]").forEach(b=>b.onclick=()=>addSymbol({
        emoji:b.dataset.emoji,
        label:b.dataset.label,
        image:b.dataset.image
      }));
      panel.querySelectorAll("[data-custom]").forEach(b=>b.onclick=()=>addSymbol(customs[+b.dataset.custom]));
      panel.querySelector(".add-symbol").onclick=()=>customSymbolInput.click();
    }
    buildSymbols();
    modal.querySelector("#symbolTool").onclick=()=>{panel.classList.toggle("hidden");buildSymbols();};
    const customSymbolInput=document.createElement("input");customSymbolInput.type="file";customSymbolInput.accept="image/png,image/jpeg,image/webp,image/svg+xml";customSymbolInput.hidden=true;modal.appendChild(customSymbolInput);
    customSymbolInput.onchange=async()=>{const f=customSymbolInput.files[0];if(!f)return;const image=await readFile(f);const arr=getCustomSymbols();arr.push({name:f.name.replace(/\.[^.]+$/,""),image});saveCustomSymbols(arr);buildSymbols();customSymbolInput.value="";};
    function addSymbol(s){pushHistory();objects.push({type:"symbol",name:s.name||"Icono",label:s.label||s.name||"",emoji:s.emoji,size:70,x:canvas.width/2,y:canvas.height/2,rot:0,image:s.image,color:color.value});selected=objects.length-1;size.value=70;sizeOut.value="70";panel.classList.add("hidden");setTool('select');draw();}

    canvas.addEventListener("pointerdown",(e)=>{
      const p=pointer(e);canvas.setPointerCapture(e.pointerId);
      if(tool==='select'){
        if(selected>=0){const b=bounds(objects[selected]);const rotHandle={x:b.x+b.w/2,y:b.y-38};if(dist(p,rotHandle)<18){drag={mode:'rotate',start:p,original:JSON.parse(JSON.stringify(objects[selected]))};return;}}
        for(let i=objects.length-1;i>=0;i--)if(hit(objects[i],p)){selected=i;color.value=objects[i].color||color.value; if(objects[i].size) {size.value=objects[i].size;sizeOut.value=objects[i].size;}drag={mode:'move',start:p,original:JSON.parse(JSON.stringify(objects[i]))};draw();return;}
        selected=-1;draw();return;
      }
      if(tool==='pen'){pushHistory();const o={type:'path',points:[p],color:color.value,width:+width.value};objects.push(o);selected=objects.length-1;drag={mode:'draw',index:selected};draw();return;}
      if(['arrow','rect','circle'].includes(tool)){drag={mode:'shape',start:p};previewObject={type:tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:color.value,width:+width.value};draw();return;}
    });
    canvas.addEventListener("pointermove",(e)=>{
      const p=pointer(e);if(!drag)return;
      if(drag.mode==='draw'){objects[drag.index].points.push(p);draw();return;}
      if(drag.mode==='shape'){previewObject={...previewObject,x2:p.x,y2:p.y};draw();return;}
      if(drag.mode==='move'){const o=objects[selected],dx=p.x-drag.start.x,dy=p.y-drag.start.y,orig=drag.original; if(o.type==='path'){const ox=orig.points[0].x,oy=orig.points[0].y;o.points=o.points.map((q,i)=>({x:q.x+(dx),y:q.y+(dy)}));} else if(['rect','circle','arrow'].includes(o.type)){o.x1=orig.x1+dx;o.y1=orig.y1+dy;o.x2=orig.x2+dx;o.y2=orig.y2+dy;} else {o.x=orig.x+dx;o.y=orig.y+dy;}draw();return;}
      if(drag.mode==='rotate'){const o=objects[selected],c=center(o),a0=Math.atan2(drag.start.y-c.y,drag.start.x-c.x),a1=Math.atan2(p.y-c.y,p.x-c.x);o.rot=(drag.original.rot||0)+(a1-a0)*180/Math.PI;draw();return;}
    });
    canvas.addEventListener("pointerup",(e)=>{
      if(!drag)return;const p=pointer(e);
      if(drag.mode==='shape'){if(dist(drag.start,p)>8){pushHistory();objects.push({...previewObject,rot:0});selected=objects.length-1;setTool('select');}previewObject=null;draw();}
      if(drag.mode==='draw'){setTool('select');draw();}
      drag=null;
    });

    modal.querySelector(".modal-close").onclick=()=>modal.remove();
    modal.querySelector(".cancel-edit").onclick=()=>modal.remove();
    modal.querySelector(".save-edit").onclick=async()=>{
      try{const annotated=canvas.toDataURL("image/jpeg",.92);await dbPut(stores.photos,{...photo,data:annotated,original:photo.original||photo.data,objects,annotated:true});modal.remove();await openDetail(currentWork.id);await renderWorks();}catch(error){showError(error);}
    };
  }

  // ---- Visor de fotos a pantalla completa (zoom, swipe, descripción) ----
  function openLightbox(photos, startIndex) {
    if (!photos.length) return;
    let index = startIndex;
    let scale = 1, tx = 0, ty = 0;
    let pinchStartDist = 0, pinchStartScale = 1;
    let dragStart = null, dragOrigin = null;
    let lastTap = 0;
    const pointers = new Map();

    const modal = document.createElement("div");
    modal.className = "lightbox-modal";
    modal.innerHTML = `
      <button type="button" class="lightbox-close" aria-label="Cerrar">×</button>
      <button type="button" class="lightbox-nav lightbox-prev" aria-label="Anterior">‹</button>
      <button type="button" class="lightbox-nav lightbox-next" aria-label="Siguiente">›</button>
      <div class="lightbox-stage"><img class="lightbox-img" alt=""></div>
      <div class="lightbox-footer">
        <p class="lightbox-desc"></p>
        <div class="lightbox-meta"><span class="lightbox-date"></span><span class="lightbox-counter"></span></div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const img = modal.querySelector(".lightbox-img");
    const stage = modal.querySelector(".lightbox-stage");
    const desc = modal.querySelector(".lightbox-desc");
    const dateEl = modal.querySelector(".lightbox-date");
    const counter = modal.querySelector(".lightbox-counter");

    function applyTransform() {
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }

    function resetZoom() {
      scale = 1; tx = 0; ty = 0;
      applyTransform();
    }

    function clampPan() {
      const maxPan = 400 * (scale - 1);
      tx = Math.max(-maxPan, Math.min(maxPan, tx));
      ty = Math.max(-maxPan, Math.min(maxPan, ty));
    }

    function render() {
      const photo = photos[index];
      img.src = photo.data;
      desc.textContent = photo.description || "Sin descripción";
      dateEl.textContent = new Date(photo.created || Date.now()).toLocaleString("es-AR");
      counter.textContent = `${index + 1} / ${photos.length}`;
      modal.querySelector(".lightbox-prev").style.visibility = photos.length > 1 ? "visible" : "hidden";
      modal.querySelector(".lightbox-next").style.visibility = photos.length > 1 ? "visible" : "hidden";
      resetZoom();
    }

    function go(delta) {
      index = (index + delta + photos.length) % photos.length;
      render();
    }

    function close() {
      document.body.style.overflow = "";
      modal.remove();
    }

    modal.querySelector(".lightbox-close").addEventListener("click", close);
    modal.querySelector(".lightbox-prev").addEventListener("click", () => go(-1));
    modal.querySelector(".lightbox-next").addEventListener("click", () => go(1));
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target === stage) close(); });

    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    document.addEventListener("keydown", onKey);
    const observer = new MutationObserver(() => {
      if (!document.body.contains(modal)) {
        document.removeEventListener("keydown", onKey);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });

    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    img.addEventListener("pointerdown", (e) => {
      img.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragStart = { x: e.clientX, y: e.clientY, time: Date.now() };
        dragOrigin = { tx, ty };
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDist = dist(a, b);
        pinchStartScale = scale;
      }
    });

    img.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const newDist = dist(a, b);
        if (pinchStartDist > 0) {
          scale = Math.max(1, Math.min(4, pinchStartScale * (newDist / pinchStartDist)));
          clampPan();
          applyTransform();
        }
        return;
      }

      if (pointers.size === 1 && dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (scale > 1.02) {
          tx = dragOrigin.tx + dx;
          ty = dragOrigin.ty + dy;
          clampPan();
          applyTransform();
        } else {
          tx = dx * 0.4;
          applyTransform();
        }
      }
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0 && dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const elapsed = Date.now() - dragStart.time;

        if (scale <= 1.02) {
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
            go(dx < 0 ? 1 : -1);
          } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && elapsed < 300) {
            const now = Date.now();
            if (now - lastTap < 320) {
              scale = 2.4; clampPan(); applyTransform();
              lastTap = 0;
            } else {
              lastTap = now;
              tx = 0; applyTransform();
            }
          } else {
            tx = 0; applyTransform();
          }
        }
        dragStart = null;
      }
      if (pointers.size < 2) pinchStartDist = 0;
    }
    img.addEventListener("pointerup", endPointer);
    img.addEventListener("pointercancel", endPointer);

    img.addEventListener("dblclick", () => {
      if (scale > 1.02) resetZoom();
      else { scale = 2.4; applyTransform(); }
    });

    img.addEventListener("wheel", (e) => {
      e.preventDefault();
      scale = Math.max(1, Math.min(4, scale - e.deltaY * 0.0015));
      clampPan();
      applyTransform();
    }, { passive: false });

    render();
  }

  function init(){renderWorks();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
