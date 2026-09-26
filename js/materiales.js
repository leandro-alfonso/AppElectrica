(() => {
  "use strict";

  const { uid, dbPut, dbGetAll, dbGet, dbDelete, readFile, escapeHtml, showError, stores } = window.Electricista;

  let editingId = null;
  let oldPhoto = "";

  const QUICK_ICONS = [
    { file: "TomaSimple", label: "Toma simple", category: "Tomas" },
    { file: "TomaDoble", label: "Toma doble", category: "Tomas" },
    { file: "Toma20A", label: "Toma 20A", category: "Tomas" },
    { file: "PuntoSimple", label: "Tecla simple", category: "Teclas" },
    { file: "PuntoDoble", label: "Tecla doble", category: "Teclas" },
    { file: "PuntoToma", label: "Tecla + toma", category: "Teclas" },
    { file: "3puntos", label: "Tecla triple", category: "Teclas" },
    { file: "Termica10A", label: "Térmica 10A", category: "Térmicas" },
    { file: "Termica15A", label: "Térmica 15A", category: "Térmicas" },
    { file: "Termica20A", label: "Térmica 20A", category: "Térmicas" },
    { file: "Disyuntor40A", label: "Disyuntor 40A", category: "Disyuntores" },
    { file: "CajaOctagonal", label: "Caja octogonal", category: "Cajas" },
    { file: "CajaEstanco", label: "Caja estanco", category: "Cajas" },
    { file: "TableroTermica", label: "Tablero térmicas", category: "Otros" }
  ];

  const $ = (id) => document.getElementById(id);
  const materialModal = $("materialModal");
  const listModal = $("listModal");
  const materialList = $("materialList");
  const emptyMaterials = $("emptyMaterials");
  const materialForm = $("materialForm");
  const iconPickerStrip = $("iconPickerStrip");

  function iconPath(file) {
    return `img/materiales_transparent/${file}.png`;
  }

  function renderIconPicker() {
    if (!iconPickerStrip) return;
    iconPickerStrip.innerHTML = "";
    QUICK_ICONS.forEach((icon) => {
      const path = iconPath(icon.file);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-pick-btn";
      if (oldPhoto === path) btn.classList.add("selected");
      btn.innerHTML = `<img src="${path}" alt="${icon.label}"><span>${icon.label}</span>`;
      btn.addEventListener("click", () => {
        oldPhoto = path;
        $("photoPreview").innerHTML = `<img src="${path}" alt="Vista previa">`;
        iconPickerStrip.querySelectorAll(".icon-pick-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      iconPickerStrip.appendChild(btn);
    });
  }

  const SEED_FLAG = "electricistaMaterialesSeeded";

  async function seedDefaultCatalog() {
    if (localStorage.getItem(SEED_FLAG)) return;
    try {
      const existing = await dbGetAll(stores.materials);
      if (existing.length === 0) {
        let i = 0;
        for (const icon of QUICK_ICONS) {
          await dbPut(stores.materials, {
            id: uid(),
            name: icon.label,
            category: icon.category,
            brand: "",
            model: "",
            observation: "",
            qty: 0,
            photo: iconPath(icon.file),
            created: Date.now() + i++
          });
        }
      }
      localStorage.setItem(SEED_FLAG, "1");
    } catch (error) {
      showError(error);
    }
  }

  function closeModal(modal) {
    if (modal) modal.classList.add("hidden");
  }

  function openMaterial(material = null) {
    editingId = material?.id || null;
    oldPhoto = material?.photo || "";

    $("materialModalTitle").textContent = material ? "Editar material" : "Nuevo material";
    $("materialId").value = material?.id || "";
    $("matName").value = material?.name || "";
    $("matCategory").value = material?.category || "Tomas";
    $("matBrand").value = material?.brand || "";
    $("matModel").value = material?.model || "";
    $("matObservation").value = material?.observation || "";
    $("matQty").value = material && material.qty != null ? material.qty : 1;
    $("matPhoto").value = "";
    $("photoPreview").innerHTML = oldPhoto ? `<img src="${oldPhoto}" alt="Foto del material">` : "";
    renderIconPicker();
    materialModal.classList.remove("hidden");
    setTimeout(() => $("matName").focus(), 0);
  }

  async function saveMaterial(event) {
    event.preventDefault();
    try {
      const name = $("matName").value.trim();
      if (!name) {
        $("matName").focus();
        alert("Ingresá el nombre del material.");
        return;
      }

      const old = editingId ? await dbGet(stores.materials, editingId) : null;
      const material = {
        id: editingId || uid(),
        name,
        category: $("matCategory").value,
        brand: $("matBrand").value.trim(),
        model: $("matModel").value.trim(),
        observation: $("matObservation").value.trim(),
        qty: Math.max(0, Number($("matQty").value) || 0),
        photo: oldPhoto || old?.photo || "",
        created: old?.created || Date.now()
      };

      await dbPut(stores.materials, material);
      closeModal(materialModal);
      await renderMaterials();
    } catch (error) {
      showError(error);
    }
  }

  // El botón de cámara usa capture; el botón de galería NO lo usa para que el móvil
  // muestre el selector de archivos/fotos en lugar de abrir directamente la cámara.
  $("matCameraBtn")?.addEventListener("click", () => {
    const input = $("matPhoto");
    input.setAttribute("capture", "environment");
    input.click();
  });

  $("matGalleryBtn")?.addEventListener("click", () => {
    const input = $("matPhoto");
    input.removeAttribute("capture");
    input.click();
  });

  async function handlePhoto(event) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      oldPhoto = await readFile(file);
      $("photoPreview").innerHTML = `<img src="${oldPhoto}" alt="Vista previa">`;
      renderIconPicker();
    } catch (error) {
      showError(error);
    }
  }

  async function renderMaterials() {
    try {
      let materials = await dbGetAll(stores.materials);
      const query = $("materialSearch").value.trim().toLowerCase();
      const category = $("categoryFilter").value;

      materials = materials
        .filter((material) => {
          const text = `${material.name || ""} ${material.brand || ""} ${material.model || ""}`.toLowerCase();
          return (!query || text.includes(query)) && (!category || material.category === category);
        })
        .sort((a, b) => (b.created || 0) - (a.created || 0));

      materialList.innerHTML = "";
      emptyMaterials.classList.toggle("hidden", materials.length > 0);

      for (const material of materials) {
        const card = document.createElement("article");
        const qty = Number(material.qty) || 0;
        card.className = "material-card" + (qty > 0 ? " in-list" : "");
        card.dataset.category = material.category || "Otros";
        card.innerHTML = `
          <div class="material-photo">
            ${material.photo ? `<img src="${material.photo}" alt="">` : "🧰"}
            ${qty > 0 ? `<span class="material-qty-badge">×${qty}</span>` : ""}
          </div>
          <div class="material-info">
            <span class="material-category">${escapeHtml(material.category || "Otros")}</span>
            <h3>${escapeHtml(material.name || "Sin nombre")}</h3>
            <p><strong>${escapeHtml(material.brand || "Sin marca")}</strong>${material.model ? ` · ${escapeHtml(material.model)}` : ""}</p>
            ${material.observation ? `<p>${escapeHtml(material.observation)}</p>` : ""}
            <div class="qty-row">
              <strong>Necesito</strong>
              <div class="qty-controls">
                <button type="button" class="minus">−</button>
                <span>${qty}</span>
                <button type="button" class="plus">+</button>
              </div>
            </div>
            <div class="material-actions">
              <button type="button" class="edit btn-secondary">✏️ Editar</button>
              <button type="button" class="del btn-danger">🗑️</button>
            </div>
          </div>`;

        card.querySelector(".minus").addEventListener("click", () => changeQty(material.id, -1));
        card.querySelector(".plus").addEventListener("click", () => changeQty(material.id, 1));
        card.querySelector(".edit").addEventListener("click", () => openMaterial(material));
        card.querySelector(".del").addEventListener("click", () => deleteMaterial(material.id));
        materialList.appendChild(card);
      }
    } catch (error) {
      showError(error);
    }
  }

  async function changeQty(id, delta) {
    try {
      const material = await dbGet(stores.materials, id);
      if (!material) return;
      material.qty = Math.max(0, (Number(material.qty) || 0) + delta);
      await dbPut(stores.materials, material);
      await renderMaterials();
    } catch (error) {
      showError(error);
    }
  }

  async function deleteMaterial(id) {
    if (!confirm("¿Eliminar este material?")) return;
    try {
      await dbDelete(stores.materials, id);
      await renderMaterials();
    } catch (error) {
      showError(error);
    }
  }

  async function renderList() {
    try {
      const materials = (await dbGetAll(stores.materials)).filter((m) => (Number(m.qty) || 0) > 0);
      if (!materials.length) {
        alert("No hay materiales con cantidad asignada todavía. Sumá cantidades con el + en cada tarjeta.");
        return;
      }

      const groups = {};
      materials.forEach((material) => {
        const category = material.category || "Otros";
        (groups[category] ||= []).push(material);
      });

      let html = `<div id="shareList"><span class="eyebrow">LISTA DE MATERIALES</span><h2>Materiales necesarios</h2>`;
      for (const [category, items] of Object.entries(groups)) {
        html += `<h3 class="list-category">${escapeHtml(category)}</h3>`;
        for (const material of items) {
          html += `<div class="list-item"><span>${escapeHtml(material.name)}${material.brand ? ` · ${escapeHtml(material.brand)}` : ""}</span><strong>× ${Number(material.qty) || 1}</strong></div>`;
        }
      }
      html += `</div><div class="list-actions"><button type="button" class="btn btn-primary" id="saveShareList">💾 Guardar / compartir</button><button type="button" class="btn btn-secondary" id="whatsappShareList">🟢 Enviar por WhatsApp</button></div>`;

      $("listContent").innerHTML = html;
      listModal.classList.remove("hidden");
      $("saveShareList").addEventListener("click", () => shareList(materials));
      $("whatsappShareList").addEventListener("click", () => shareListWhatsapp(materials));
    } catch (error) {
      showError(error);
    }
  }

  function shareListWhatsapp(materials) {
    const groups = {};
    materials.forEach((material) => (groups[material.category || "Otros"] ||= []).push(material));
    const lines = [
      "*Lista de materiales – Electricista App*",
      "",
      ...Object.entries(groups).flatMap(([category, items]) => [
        `*${category}*`,
        ...items.map((material) => `• ${material.name}${material.brand ? ` (${material.brand})` : ""} x${Number(material.qty) || 1}`),
        ""
      ])
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function shareList(materials) {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const groups = {};
      materials.forEach((material) => (groups[material.category || "Otros"] ||= []).push(material));
      const lines = [
        "ELECTRICISTA APP",
        "LISTA DE MATERIALES",
        "",
        ...Object.entries(groups).flatMap(([category, items]) => [
          category.toUpperCase(),
          ...items.map((material) => `• ${material.name}  × ${Number(material.qty) || 1}`),
          ""
        ])
      ];
      canvas.width = 900;
      canvas.height = Math.max(500, lines.length * 34 + 80);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#171717";
      ctx.font = "bold 32px Arial";
      ctx.fillText(lines[0], 40, 55);
      ctx.font = "bold 22px Arial";
      let y = 100;
      lines.slice(1).forEach((line) => { ctx.fillText(line, 40, y); y += 34; });

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("No se pudo generar la imagen.");
        const file = new File([blob], "lista-materiales.png", { type: "image/png" });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ title: "Lista de materiales", files: [file] }); } catch (error) {
            if (error?.name !== "AbortError") throw error;
          }
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "lista-materiales.png";
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }, "image/png");
    } catch (error) {
      showError(error);
    }
  }

  async function init() {
    $("addMaterialBtn")?.addEventListener("click", () => openMaterial());
    $("emptyAddBtn")?.addEventListener("click", () => openMaterial());
    $("viewListBtn")?.addEventListener("click", renderList);
    $("materialSearch")?.addEventListener("input", renderMaterials);
    $("categoryFilter")?.addEventListener("change", renderMaterials);
    $("matPhoto")?.addEventListener("change", handlePhoto);
    materialForm?.addEventListener("submit", saveMaterial);
    renderIconPicker();

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.closest(".modal")));
    });

    await seedDefaultCatalog();
    renderMaterials();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
